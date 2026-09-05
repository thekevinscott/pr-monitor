import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { makePredictor } from './makePredictor';

const PREDICTION = {
  entries: [
    {
      workflow: '.github/workflows/test.yml',
      job: 'unit',
      checkName: 'unit',
      status: 'run',
      reason: 'trigger matched',
    },
  ],
  checkNames: ['unit'],
  skip: null,
  sources: [{ owner: 'o', repo: 'r', ref: 'head-sha', sha: 'head-sha' }],
};

const PRINT_PREDICTION = `console.log(${JSON.stringify(JSON.stringify(PREDICTION))});`;

/** Stands in for willfire's CLI: `node <file>` is the whole contract this side owns. */
async function stubCli(body: string): Promise<string> {
  const cli = join(await mkdtemp(join(tmpdir(), 'pr-monitor-cli-')), 'cli.cjs');
  await writeFile(cli, body);
  return cli;
}

/** A stub that reports one expression to `probe` before answering normally. */
async function probing(expression: string): Promise<{ cli: string; read: () => Promise<string> }> {
  const probe = join(await mkdtemp(join(tmpdir(), 'pr-monitor-probe-')), 'probe');
  const write = `require('node:fs').writeFileSync(${JSON.stringify(probe)}, String(${expression}));`;
  return { cli: await stubCli(write + PRINT_PREDICTION), read: () => readFile(probe, 'utf8') };
}

test('the JSON the CLI prints is the prediction the gate reads', async () => {
  const prediction = await makePredictor(await stubCli(PRINT_PREDICTION), 'tok')('o/r', 5, {});
  expect(prediction).toEqual(PREDICTION);
});

test('the CLI is invoked with the flags predictArgs builds', async () => {
  const { cli, read } = await probing('process.argv.slice(2).join(" ")');
  await makePredictor(cli, 'tok')('o/r', 5, { action: 'opened', callbacks: ['echo {}'] });
  expect(await read()).toBe('--repo o/r --pr 5 --action opened --callback echo {} --json');
});

test('the configured token reaches the CLI as GH_TOKEN', async () => {
  const { cli, read } = await probing('process.env.GH_TOKEN');
  await makePredictor(cli, 'configured')('o/r', 5, {});
  expect(await read()).toBe('configured');
});

test('the configured token outranks a GH_TOKEN already in the environment', async () => {
  const { cli, read } = await probing('process.env.GH_TOKEN');
  process.env.GH_TOKEN = 'ambient';
  try {
    await makePredictor(cli, 'configured')('o/r', 5, {});
  } finally {
    delete process.env.GH_TOKEN;
  }
  expect(await read()).toBe('configured');
});

test('no cwd is pinned, so a resolver callback still inherits the workspace', async () => {
  const { cli, read } = await probing('process.cwd()');
  await makePredictor(cli, 'tok')('o/r', 5, {});
  expect(await read()).toBe(process.cwd());
});

test('a CLI that fails is reported with what it said, not swallowed', async () => {
  const cli = await stubCli('console.error("no such pull request");process.exit(1);');
  await expect(makePredictor(cli, 'tok')('o/r', 5, {})).rejects.toThrow('no such pull request');
});

test('a CLI that fails silently is still reported', async () => {
  const cli = await stubCli('process.exit(3);');
  await expect(makePredictor(cli, 'tok')('o/r', 5, {})).rejects.toThrow(/Command failed/);
});

test('a CLI that cannot be started is reported rather than read as an empty prediction', async () => {
  await expect(makePredictor('/nonexistent/cli.cjs', 'tok')('o/r', 5, {})).rejects.toThrow(
    /Cannot find module/,
  );
});

test('output that is not a prediction is reported, never parsed into an empty gate', async () => {
  const cli = await stubCli('console.log("not json at all");');
  await expect(makePredictor(cli, 'tok')('o/r', 5, {})).rejects.toThrow('not json at all');
});
