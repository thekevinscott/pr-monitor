import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { willfire } from 'willfire';
import type { JobName } from 'willfire';
import { monitor } from '../../src/monitor';
import { sleep } from '../../src/timing/sleep';
import type { MonitorParams } from '../../src/types';

const SELF = '.github/workflows/pr-monitor.yml';
const TESTS = '.github/workflows/tests.yml';

vi.mock('willfire', () => ({ willfire: vi.fn() }));
vi.mock('../../src/timing/sleep', () => ({ sleep: vi.fn(async () => {}) }));

const prediction: Awaited<ReturnType<typeof willfire>> = {
  entries: [
    { workflow: SELF, job: 'gate' as JobName, checkName: 'CI Gate', status: 'run', reason: '' },
    { workflow: TESTS, job: 'unit' as JobName, checkName: 'Unit', status: 'run', reason: '' },
  ],
  checkNames: ['CI Gate', 'Unit'],
  sources: [],
  skip: null,
};

const serverError = (status: number, endpoint: string) => Object.assign(
  new Error('Server Error'),
  { status, request: { url: endpoint } },
);

beforeEach(() => {
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF}@refs/pull/5/merge`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(willfire).mockResolvedValue(prediction);
});

afterEach(() => {
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
  vi.mocked(willfire).mockReset();
  vi.mocked(sleep).mockReset();
});

async function gate(pollErrors: Error[] = [], jobErrors: Error[] = []): Promise<string[]> {
  const failures: string[] = [];
  await monitor({
    github: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: vi.fn(async () => {
            const error = pollErrors.shift();
            if (error) throw error;
            return { data: { workflow_runs: [
              { id: 1, name: 'Tests', path: TESTS, event: 'pull_request', status: 'completed', conclusion: 'success' },
            ] } };
          }),
          listJobsForWorkflowRun: vi.fn(async () => {
            const error = jobErrors.shift();
            if (error) throw error;
            return { data: { jobs: [
              { id: 1, name: 'Unit', status: 'completed', conclusion: 'success' },
            ] } };
          }),
        },
      },
    },
    predictClient: {},
    context: {
      repo: { owner: 'o', repo: 'r' },
      payload: { pull_request: { number: 5, head: { sha: 'head-sha' } } },
    },
    core: { setFailed: (message: string) => failures.push(message) },
  } as unknown as MonitorParams);
  return failures;
}

test('two 502s during polling recover on the existing tick', async () => {
  expect(await gate([
    serverError(502, '/repos/o/r/actions/runs'),
    serverError(502, '/repos/o/r/actions/runs'),
  ])).toEqual([]);
  expect(vi.mocked(sleep).mock.calls).toEqual([[30_000], [30_000]]);
});

test('a 504 fetching workflow jobs retries the complete poll read', async () => {
  expect(await gate([], [serverError(504, '/repos/o/r/actions/runs/1/jobs')])).toEqual([]);
  expect(vi.mocked(sleep).mock.calls).toEqual([[30_000]]);
});

test('a 503 during prediction retries before the first poll', async () => {
  vi.mocked(willfire)
    .mockRejectedValueOnce(Object.assign(new Error('GitHub API 503 for /repos/o/r/pulls/5'), {
      status: 503,
    }))
    .mockResolvedValue(prediction);
  expect(await gate()).toEqual([]);
  expect(vi.mocked(willfire)).toHaveBeenCalledTimes(2);
  expect(vi.mocked(sleep).mock.calls).toEqual([[30_000]]);
});

test('a sustained poll error fails after four ticks with status and endpoint', async () => {
  const failures = await gate(Array.from({ length: 5 }, () =>
    serverError(504, '/repos/o/r/actions/runs'),
  ));
  expect(failures).toEqual([
    'GitHub API 504 for /repos/o/r/actions/runs remained unavailable after 120s of retries',
  ]);
  expect(vi.mocked(sleep)).toHaveBeenCalledTimes(4);
});

test('a sustained prediction error fails before polling starts', async () => {
  vi.mocked(willfire).mockRejectedValue(serverError(500, '/repos/o/r/pulls/5'));
  expect(await gate()).toEqual([
    'GitHub API 500 for /repos/o/r/pulls/5 remained unavailable after 120s of retries',
  ]);
  expect(vi.mocked(willfire)).toHaveBeenCalledTimes(5);
  expect(vi.mocked(sleep)).toHaveBeenCalledTimes(4);
});

test('a 403 without quota headers remains fatal immediately', async () => {
  await expect(gate([serverError(403, '/repos/o/r/actions/runs')]))
    .rejects.toThrow('Server Error');
  expect(vi.mocked(sleep)).not.toHaveBeenCalled();
});
