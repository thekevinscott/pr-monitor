import { execFile } from 'node:child_process';
import { expect, test, vi } from 'vitest';
import { makePredictor } from './makePredictor';

vi.mock('node:child_process', async () => ({
  ...(await vi.importActual<typeof import('node:child_process')>('node:child_process')),
  execFile: vi.fn(),
}));

const CLI = '/w/willfire/dist/cli.js';
const PREDICTION = { entries: [], checkNames: [], skip: null, sources: [] };

interface Spawned {
  file: string;
  args: string[];
  options: { env: NodeJS.ProcessEnv; cwd?: string; maxBuffer: number };
}

/** Answers the callback the way `promisify(execFile)` reads it, and records the call. */
function spawnAnswers(failure: unknown, stdout = ''): () => Spawned {
  const seen: Spawned[] = [];
  vi.mocked(execFile).mockImplementation(((
    file: string,
    args: string[],
    options: Spawned['options'],
    done: (err: unknown, value: { stdout: string }) => void,
  ) => {
    seen.push({ file, args, options });
    done(failure, { stdout });
  }) as unknown as typeof execFile);
  return () => seen[0];
}

test('the JSON the CLI prints is the prediction the gate reads', async () => {
  spawnAnswers(null, JSON.stringify(PREDICTION));
  await expect(makePredictor(CLI, 'tok')('o/r', 5, {})).resolves.toEqual(PREDICTION);
});

test('node runs the resolved CLI with the flags predictArgs builds', async () => {
  const call = spawnAnswers(null, JSON.stringify(PREDICTION));
  await makePredictor(CLI, 'tok')('o/r', 5, { action: 'opened', callbacks: ['echo {}'] });
  expect(call().file).toBe(process.execPath);
  expect(call().args).toEqual([
    CLI,
    '--repo',
    'o/r',
    '--pr',
    '5',
    '--action',
    'opened',
    '--callback',
    'echo {}',
    '--json',
  ]);
});

test('the configured token is handed over as GH_TOKEN, which willfire reads first', async () => {
  const call = spawnAnswers(null, JSON.stringify(PREDICTION));
  await makePredictor(CLI, 'configured')('o/r', 5, {});
  expect(call().options.env.GH_TOKEN).toBe('configured');
});

test('the rest of the environment carries through for the callbacks to inherit', async () => {
  const call = spawnAnswers(null, JSON.stringify(PREDICTION));
  await makePredictor(CLI, 'tok')('o/r', 5, {});
  expect(call().options.env.PATH).toBe(process.env.PATH);
});

test('no cwd is pinned, so a resolver callback still inherits the workspace', async () => {
  const call = spawnAnswers(null, JSON.stringify(PREDICTION));
  await makePredictor(CLI, 'tok')('o/r', 5, {});
  expect(call().options.cwd).toBeUndefined();
});

test('a prediction larger than execFile’s 1MB default is still read whole', async () => {
  const call = spawnAnswers(null, JSON.stringify(PREDICTION));
  await makePredictor(CLI, 'tok')('o/r', 5, {});
  expect(call().options.maxBuffer).toBeGreaterThan(1024 * 1024);
});

test('a CLI that fails is reported with what it said, not swallowed', async () => {
  spawnAnswers({ stderr: '  GH_TOKEN or GITHUB_TOKEN must be set\n' });
  await expect(makePredictor(CLI, 'tok')('o/r', 5, {})).rejects.toThrow(
    'willfire prediction failed: GH_TOKEN or GITHUB_TOKEN must be set',
  );
});

test('a CLI that fails silently is reported by what went wrong instead', async () => {
  spawnAnswers(new Error('Command failed: node cli.js'));
  await expect(makePredictor(CLI, 'tok')('o/r', 5, {})).rejects.toThrow(
    /willfire prediction failed: .*Command failed/,
  );
});

test('output that is not a prediction is reported, never read as an empty gate', async () => {
  spawnAnswers(null, '\n  not json at all\n');
  await expect(makePredictor(CLI, 'tok')('o/r', 5, {})).rejects.toThrow(
    'willfire printed no prediction: not json at all',
  );
});
