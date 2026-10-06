import { afterEach, expect, test, vi } from 'vitest';
import { monitor } from '../../src/monitor';
import type { MonitorParams } from '../../src/types';

const SELF = '.github/workflows/pr-monitor.yml';
const PUSH = '.github/workflows/tests.yml';

vi.mock('willfire', () => ({
  willfire: vi.fn(async () => ({
    entries: [
      { workflow: SELF, job: 'gate', checkName: 'CI Gate', status: 'run', reason: 'trigger matched' },
      { workflow: PUSH, job: '*', checkName: null, status: 'no-dispatch', reason: 'no pull_request trigger' },
    ],
    checkNames: ['CI Gate'],
    sources: [],
    skip: null,
  })),
}));

afterEach(() => {
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
});

async function runGate(withPushRun: boolean): Promise<string[]> {
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF}@refs/pull/5/merge`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const failures: string[] = [];
  const workflow_runs = [
    { id: 1, name: 'CI Gate', path: SELF, event: 'pull_request', status: 'completed', conclusion: 'success' },
    ...(withPushRun
      ? [{ id: 2, name: 'Tests', path: PUSH, event: 'push', status: 'completed', conclusion: 'success' }]
      : []),
  ];
  await monitor({
    github: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: vi.fn(async () => ({ data: { workflow_runs } })),
          listJobsForWorkflowRun: vi.fn(async () => ({ data: { jobs: [] } })),
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

test('a push-only CI run makes an empty PR prediction fail visibly', async () => {
  expect((await runGate(true)).join(' ')).toMatch(/push/i);
});

test('an empty PR prediction can pass when no other CI run exists', async () => {
  expect(await runGate(false)).toEqual([]);
});
