/**
 * Closing and reopening a PR, or re-triggering it, starts fresh runs on the same head SHA. Only
 * the newest run of each workflow speaks for it (#242; dirsql#1439 stayed red on stale failures).
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { monitor } from '../../src/monitor';
import type { MonitorParams } from '../../src/types';

const SELF = '.github/workflows/pr-monitor.yml';
const TESTS = '.github/workflows/tests.yml';

vi.mock('willfire', () => ({
  willfire: vi.fn(async () => ({
    entries: [
      { workflow: SELF, job: 'gate', checkName: 'CI Gate', status: 'run', reason: 'trigger matched' },
      { workflow: TESTS, job: 'unit', checkName: 'unit', status: 'run', reason: 'trigger matched' },
    ],
    checkNames: ['CI Gate', 'unit'],
    sources: [],
    skip: null,
  })),
}));

interface Run {
  id: number;
  conclusion: string;
}

beforeEach(() => {
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF}@refs/pull/5/merge`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
});

async function gate(testRuns: Run[]): Promise<string[]> {
  const failures: string[] = [];
  const workflow_runs = [
    { id: 1, name: 'PR Monitor', path: SELF, event: 'pull_request', status: 'in_progress', conclusion: null },
    ...testRuns.map(({ id, conclusion }) => ({
      id,
      name: 'Tests',
      path: TESTS,
      event: 'pull_request',
      status: 'completed',
      conclusion,
    })),
  ];
  await monitor({
    github: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: vi.fn(async () => ({ data: { workflow_runs } })),
          listJobsForWorkflowRun: vi.fn(async ({ run_id }: { run_id: number }) => ({
            data: {
              jobs: testRuns
                .filter((r) => r.id === run_id)
                .map((r) => ({ id: r.id * 10, name: 'unit', status: 'completed', conclusion: r.conclusion })),
            },
          })),
        },
      },
    },
    predictClient: {},
    context: {
      repo: { owner: 'o', repo: 'r' },
      payload: { action: 'reopened', pull_request: { number: 5, head: { sha: 'head-sha' } } },
    },
    core: { setFailed: (message: string) => failures.push(message) },
  } as unknown as MonitorParams);
  return failures;
}

test('a failed run superseded by a passing one on the same SHA does not fail the gate', async () => {
  expect(await gate([{ id: 10, conclusion: 'failure' }, { id: 20, conclusion: 'success' }])).toEqual([]);
});

test('the superseding run is judged whatever order the API lists runs in', async () => {
  expect(await gate([{ id: 20, conclusion: 'success' }, { id: 10, conclusion: 'failure' }])).toEqual([]);
});

test('a newer failure still fails the gate over an older pass', async () => {
  const failures = await gate([{ id: 10, conclusion: 'success' }, { id: 20, conclusion: 'failure' }]);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toContain(`${TESTS} (failure)`);
});

test('a cancelled newer run does not hide the verdict of an older one', async () => {
  expect(await gate([{ id: 10, conclusion: 'success' }, { id: 20, conclusion: 'cancelled' }])).toEqual([]);
});

test('a run cancelled with no other sibling still fails the gate', async () => {
  const failures = await gate([{ id: 10, conclusion: 'cancelled' }]);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toContain(`${TESTS} (cancelled)`);
});
