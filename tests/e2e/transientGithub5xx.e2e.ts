import { afterEach, expect, test, vi } from 'vitest';
import { monitor } from '../../src/monitor';
import { makeGithubClient } from '../../packages/willfire/src/predict/makeGithubClient';
import type { MonitorParams } from '../../src/types';

vi.mock('willfire', () => ({
  willfire: vi.fn(async (client: { getPull: (params: object) => Promise<unknown> }) => {
    await client.getPull({ owner: 'o', repo: 'r', pull_number: 5 });
    return {
      entries: [
        { workflow: '.github/workflows/pr-monitor.yml', job: 'gate', checkName: 'CI Gate', status: 'run', reason: '' },
        { workflow: '.github/workflows/tests.yml', job: 'unit', checkName: 'Unit', status: 'run', reason: '' },
      ],
      checkNames: ['CI Gate', 'Unit'],
      sources: [],
      skip: null,
    };
  }),
}));
afterEach(() => {
  vi.useRealTimers();
  delete process.env.GH_TOKEN;
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
});

test('the real willfire HTTP client recovers after a 502 response during prediction', async () => {
  vi.useFakeTimers();
  const timer = vi.spyOn(globalThis, 'setTimeout');
  process.env.GH_TOKEN = 'test-token';
  process.env.GITHUB_WORKFLOW_REF = 'o/r/.github/workflows/pr-monitor.yml@refs/pull/5/merge';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  let requests = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    requests++;
    return new Response(requests === 1 ? '{}' : '{"mergeable":true}', {
      status: requests === 1 ? 502 : 200,
    });
  });
  const failures: string[] = [];
  const pending = monitor({
    github: { rest: { actions: {
      listWorkflowRunsForRepo: async () => ({ data: { workflow_runs: [
        { id: 1, name: 'Tests', path: '.github/workflows/tests.yml', event: 'pull_request', status: 'completed', conclusion: 'success' },
      ] } }),
      listJobsForWorkflowRun: async () => ({ data: { jobs: [
        { id: 1, name: 'Unit', status: 'completed', conclusion: 'success' },
      ] } }),
    } } },
    predictClient: makeGithubClient(),
    context: {
      repo: { owner: 'o', repo: 'r' },
      payload: { pull_request: { number: 5, head: { sha: 'head-sha' } } },
    },
    core: { setFailed: (message: string) => failures.push(message) },
  } as unknown as MonitorParams);
  await vi.runAllTimersAsync();
  await pending;
  expect(failures).toEqual([]);
  expect(requests).toBe(2);
  expect(timer.mock.calls.map((call) => call[1])).toEqual([30_000]);
});
