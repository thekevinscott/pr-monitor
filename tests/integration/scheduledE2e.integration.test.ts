/**
 * The e2e suite runs live against GitHub, so it runs on a schedule and gates
 * nothing. A red run has to reach a human, so it opens an issue, or comments
 * on the one already open rather than stacking a new issue per day.
 */

import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { parse } from 'yaml';

const execFileAsync = promisify(execFile);

const TITLE = 'Scheduled e2e run failed';
const RUN_URL = 'https://github.com/o/r/actions/runs/42';

interface Step {
  name?: string;
  if?: string;
  run?: string;
  env?: Record<string, string>;
}

interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, { steps: Step[] }>;
}

const workflowPath = fileURLToPath(new URL('../../.github/workflows/e2e.yml', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const workflow = async (): Promise<Workflow> =>
  parse(await readFile(workflowPath, 'utf8')) as Workflow;

const steps = async (): Promise<Step[]> => Object.values((await workflow()).jobs).flatMap((j) => j.steps);

test('runs on a schedule and on demand, never on a pull request or push', async () => {
  const { on } = await workflow();
  expect(Object.keys(on).sort()).toEqual(['schedule', 'workflow_dispatch']);
});

test('runs the willfire e2e suite', async () => {
  expect((await steps()).map((s) => s.run)).toContain('pnpm --filter willfire run test:e2e');
});

test('reports only when an earlier step failed', async () => {
  const report = (await steps()).find((s) => s.run === 'pnpm run e2e-report');
  expect(report?.if).toBe('failure()');
});

test('can write issues and nothing else', async () => {
  expect((await workflow()).permissions).toEqual({ contents: 'read', issues: 'write' });
});

test('no run script interpolates inline', async () => {
  for (const s of await steps()) expect(s.run ?? '').not.toContain('${{');
});

interface Recorded {
  method: string;
  url: string;
  body: unknown;
}

const fakeGithub = async (openIssues: { number: number; title: string }[]) => {
  const requests: Recorded[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      requests.push({ method: req.method ?? '', url: req.url ?? '', body: raw ? JSON.parse(raw) : undefined });
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET') {
        res.end(JSON.stringify(openIssues));
        return;
      }
      res.statusCode = 201;
      res.end(JSON.stringify({ number: 7, html_url: 'https://github.com/o/r/issues/7' }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { requests, url: `http://127.0.0.1:${port}`, close: () => server.close() };
};

const report = async (apiUrl: string) =>
  execFileAsync('pnpm', ['run', '--silent', 'e2e-report'], {
    cwd: repoRoot,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      GITHUB_API_URL: apiUrl,
      GITHUB_TOKEN: 'test-token',
      E2E_OWNER: 'o',
      E2E_REPO: 'r',
      E2E_RUN_URL: RUN_URL,
    },
  });

test('a failure with no open report opens one', async () => {
  const github = await fakeGithub([]);
  try {
    await report(github.url);
    const posts = github.requests.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('/repos/o/r/issues');
    expect(posts[0].body).toMatchObject({ title: TITLE });
    expect(JSON.stringify(posts[0].body)).toContain(RUN_URL);
  } finally {
    github.close();
  }
});

test('a failure with a report already open comments on it', async () => {
  const github = await fakeGithub([
    { number: 3, title: 'unrelated' },
    { number: 5, title: TITLE },
  ]);
  try {
    await report(github.url);
    const posts = github.requests.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('/repos/o/r/issues/5/comments');
    expect(JSON.stringify(posts[0].body)).toContain(RUN_URL);
  } finally {
    github.close();
  }
});
