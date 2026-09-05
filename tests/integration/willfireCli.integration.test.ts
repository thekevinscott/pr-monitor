/**
 * Prediction goes through willfire's CLI rather than its library API (#68), so
 * the contract under test is the shipped binary's: the argv pr-monitor builds
 * has to be argv that binary accepts, and the spawn has to leave a resolver
 * callback in the workspace the monitor was started in.
 */

import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { makePredictor } from '../../src/predict/makePredictor';
import { willfireCliPath } from '../../src/predict/willfireCliPath';

// An empty token fails willfire's first GitHub read, which keeps this offline.
// Reaching that failure is the assertion: every flag before it was accepted.
const offline = makePredictor(willfireCliPath(), '');
const TOKEN_REFUSED = /GH_TOKEN or GITHUB_TOKEN must be set/;

const PREDICTION = { entries: [], checkNames: [], skip: null, sources: [] };

/** Stands in for willfire's CLI: `node <file>` is the whole contract this side owns. */
async function stubCli(body: string): Promise<string> {
  const cli = join(await mkdtemp(join(tmpdir(), 'pr-monitor-cli-')), 'cli.cjs');
  await writeFile(cli, body);
  return cli;
}

/** A stub reporting one expression to a probe file before answering normally. */
async function probing(expression: string): Promise<{ cli: string; read: () => Promise<string> }> {
  const probe = join(await mkdtemp(join(tmpdir(), 'pr-monitor-probe-')), 'probe');
  const cli = await stubCli(
    `require('node:fs').writeFileSync(${JSON.stringify(probe)}, String(${expression}));` +
      `console.log(${JSON.stringify(JSON.stringify(PREDICTION))});`,
  );
  return { cli, read: () => readFile(probe, 'utf8') };
}

test('the argv pr-monitor builds gets past willfire’s own parser', async () => {
  await expect(offline('o/r', 5, {})).rejects.toThrow(TOKEN_REFUSED);
});

test('an event action and repeated resolver callbacks are accepted flags', async () => {
  await expect(
    offline('o/r', 5, { action: 'reopened', callbacks: ['echo {}', 'printf {}'] }),
  ).rejects.toThrow(TOKEN_REFUSED);
});

test('a flag willfire rejects surfaces its usage line rather than a guess', async () => {
  await expect(offline('', 5, {})).rejects.toThrow(/usage: predict --repo owner\/name --pr N/);
});

test('a real spawn reads the prediction back off stdout', async () => {
  const cli = await stubCli(`console.log(${JSON.stringify(JSON.stringify(PREDICTION))});`);
  await expect(makePredictor(cli, 'tok')('o/r', 5, {})).resolves.toEqual(PREDICTION);
});

test('the extra process hop leaves a resolver callback in the monitor’s cwd', async () => {
  const { cli, read } = await probing('process.cwd()');
  await makePredictor(cli, 'tok')('o/r', 5, {});
  expect(await read()).toBe(process.cwd());
});

test('the configured token reaches the spawned CLI', async () => {
  const { cli, read } = await probing('process.env.GH_TOKEN');
  await makePredictor(cli, 'configured')('o/r', 5, {});
  expect(await read()).toBe('configured');
});

test('a GH_TOKEN already in the environment does not outrank the configured one', async () => {
  const { cli, read } = await probing('process.env.GH_TOKEN');
  process.env.GH_TOKEN = 'ambient';
  try {
    await makePredictor(cli, 'configured')('o/r', 5, {});
  } finally {
    delete process.env.GH_TOKEN;
  }
  expect(await read()).toBe('configured');
});

test('a CLI that cannot be started is reported, not read as an empty prediction', async () => {
  await expect(makePredictor('/nonexistent/cli.cjs', 'tok')('o/r', 5, {})).rejects.toThrow(
    /Cannot find module/,
  );
});
