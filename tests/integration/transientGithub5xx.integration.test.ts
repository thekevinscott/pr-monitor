import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { willfire } from 'willfire';
import type { JobName } from 'willfire';
import { monitor } from '../../src/monitor';
import type { MonitorParams } from '../../src/types';

const SELF = '.github/workflows/pr-monitor.yml';
const TESTS = '.github/workflows/tests.yml';

vi.mock('willfire', () => ({ willfire: vi.fn() }));

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
  vi.useFakeTimers();
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF}@refs/pull/5/merge`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(willfire).mockResolvedValue(prediction);
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
  vi.mocked(willfire).mockReset();
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
  const timer = vi.spyOn(globalThis, 'setTimeout');
  const pending = gate([
    serverError(502, '/repos/o/r/actions/runs'),
    serverError(502, '/repos/o/r/actions/runs'),
  ]);
  await vi.runAllTimersAsync();
  expect(await pending).toEqual([]);
  expect(timer.mock.calls.map((call) => call[1])).toEqual([30_000, 30_000]);
});

test('a 504 fetching workflow jobs retries the complete poll read', async () => {
  const timer = vi.spyOn(globalThis, 'setTimeout');
  const pending = gate([], [serverError(504, '/repos/o/r/actions/runs/1/jobs')]);
  await vi.runAllTimersAsync();
  expect(await pending).toEqual([]);
  expect(timer.mock.calls.map((call) => call[1])).toEqual([30_000]);
});

test('a 503 during prediction retries before the first poll', async () => {
  const timer = vi.spyOn(globalThis, 'setTimeout');
  vi.mocked(willfire)
    .mockRejectedValueOnce(Object.assign(new Error('GitHub API 503 for /repos/o/r/pulls/5'), {
      status: 503,
    }))
    .mockResolvedValue(prediction);
  const pending = gate();
  await vi.runAllTimersAsync();
  expect(await pending).toEqual([]);
  expect(vi.mocked(willfire)).toHaveBeenCalledTimes(2);
  expect(timer.mock.calls.map((call) => call[1])).toEqual([30_000]);
});

test('a sustained poll error fails after four ticks with status and endpoint', async () => {
  const timer = vi.spyOn(globalThis, 'setTimeout');
  const pending = gate(Array.from({ length: 5 }, () => serverError(504, '/repos/o/r/actions/runs')));
  await vi.runAllTimersAsync();
  const failures = await pending;
  expect(failures).toEqual([
    'GitHub API 504 for /repos/o/r/actions/runs remained unavailable after 120s of retries',
  ]);
  expect(timer.mock.calls.map((call) => call[1])).toEqual([30_000, 30_000, 30_000, 30_000]);
});

test('a sustained prediction error fails before polling starts', async () => {
  const timer = vi.spyOn(globalThis, 'setTimeout');
  vi.mocked(willfire).mockRejectedValue(serverError(500, '/repos/o/r/pulls/5'));
  const pending = gate();
  await vi.runAllTimersAsync();
  expect(await pending).toEqual([
    'GitHub API 500 for /repos/o/r/pulls/5 remained unavailable after 120s of retries',
  ]);
  expect(vi.mocked(willfire)).toHaveBeenCalledTimes(5);
  expect(timer.mock.calls.map((call) => call[1])).toEqual([30_000, 30_000, 30_000, 30_000]);
});

test('a 403 without quota headers remains fatal immediately', async () => {
  const timer = vi.spyOn(globalThis, 'setTimeout');
  await expect(gate([serverError(403, '/repos/o/r/actions/runs')]))
    .rejects.toThrow('Server Error');
  expect(timer).not.toHaveBeenCalled();
});
