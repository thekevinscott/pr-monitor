import { afterEach, expect, test, vi } from 'vitest';
import { monitor } from '../../src/monitor';
import type { MonitorParams } from '../../src/types';

const SELF = '.github/workflows/pr-monitor.yml';
const PYTHON = '.github/workflows/python.yml';

vi.mock('willfire', () => ({
  willfire: vi.fn(async () => ({
    entries: [
      { workflow: SELF, job: 'gate', checkName: 'CI Gate', status: 'run', reason: '' },
      ...['3.12', '3.13'].flatMap((version) =>
        ['Unit', 'Integration'].map((job) => ({
          workflow: PYTHON,
          job: `${job} (${version})`,
          checkName: `${job} (${version})`,
          status: 'run',
          reason: '',
        })),
      ),
    ],
    sources: [],
    skip: null,
  })),
}));

afterEach(() => {
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
});

test('skipped matrix checks with literal names satisfy their predicted cells', async () => {
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF}@refs/pull/5/merge`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const failures: string[] = [];
  const jobs = ['Unit', 'Integration'].map((job, id) => ({
    id: id + 1,
    name: `${job} (\${{ matrix.python-version }})`,
    status: 'completed',
    conclusion: 'skipped',
  }));

  await monitor({
    github: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: vi.fn(async () => ({ data: { workflow_runs: [
            { id: 1, name: 'Python', path: PYTHON, event: 'pull_request', status: 'completed', conclusion: 'success' },
          ] } })),
          listJobsForWorkflowRun: vi.fn(async () => ({ data: { jobs } })),
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

  expect(failures).toEqual([]);
});
