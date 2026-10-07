/**
 * A matrix computed by an executed job is a prediction for a run starting now. The run being
 * judged already computed its own, and when the executed job reads mutable state (putitoutthere's
 * `plan` reads git tags), the two disagree on every cell and no rerun converges (#217; dirsql#1348,
 * gate run 37491080963: observed `... 0.4.83 ...`, replayed `... 0.4.89 ...`).
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { monitor } from '../../src/monitor';
import type { MonitorParams } from '../../src/types';

const SELF = '.github/workflows/pr-monitor.yml';
const RELEASE = '.github/workflows/release-ci.yml';
const TESTS = '.github/workflows/tests.yml';
const HEAD = 'head-sha';

const steps = '    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';

const YAML: Record<string, string> = {
  [SELF]: `name: PR Monitor\non: pull_request\njobs:\n  monitor:\n${steps}`,
  [TESTS]: `name: Tests\non: pull_request\njobs:\n  unit:\n${steps}`,
  [RELEASE]:
    'name: Release CI\non: pull_request\njobs:\n' +
    `  lint:\n${steps}` +
    '  plan:\n    runs-on: ubuntu-latest\n    outputs:\n      matrix: ${{ steps.plan.outputs.matrix }}\n' +
    '    steps:\n      - id: plan\n        run: echo "matrix=$(next-versions)" >> "$GITHUB_OUTPUT"\n' +
    '  build:\n    needs: plan\n    strategy:\n      matrix:\n' +
    '        version: ${{ fromJSON(needs.plan.outputs.matrix) }}\n' +
    steps,
};

// What `plan` answers at gate time, six releases after the run below executed it.
const executor: NonNullable<MonitorParams['executor']> = {
  executeJob: async (jobId) =>
    jobId === 'plan'
      ? { ok: true, outputs: { matrix: '["0.4.89"]' } }
      : { ok: false, reason: `no stub for ${jobId}` },
};

interface Observed {
  path: string;
  conclusion: string;
  jobs: string[];
}

const RUN_IDS = [SELF, RELEASE, TESTS];

function predictClient(): MonitorParams['predictClient'] {
  return {
    getPull: async () => ({
      commits: 1,
      draft: false,
      mergeable: true,
      labels: [],
      user: { login: 'someone' },
      base: { ref: 'main', repo: { default_branch: 'main', owner: { type: 'User' } } },
      head: { sha: HEAD, ref: 'topic', repo: { full_name: 'o/r' } },
      merge_commit_sha: null,
    }),
    listPulls: async () => [],
    listPullFiles: async () => [{ filename: 'src/index.ts' }],
    getCommit: async ({ ref }: { ref: string }) => ({
      sha: ref,
      parents: [],
      commit: { message: 'a normal commit' },
    }),
    getContent: async ({ path }: { path: string }) => {
      if (!(path in YAML)) throw Object.assign(new Error(`404 ${path}`), { status: 404 });
      return YAML[path];
    },
    listWorkflows: async () => Object.keys(YAML).map((path) => ({ path, state: 'active' })),
    listWorkflowFiles: async () => [],
  } as unknown as MonitorParams['predictClient'];
}

function octokit(observed: Observed[]): MonitorParams['github'] {
  const runs = [
    { path: SELF, status: 'in_progress', conclusion: null, jobs: ['monitor'] },
    ...observed.map((o) => ({ ...o, status: 'completed' })),
  ];
  return {
    rest: {
      actions: {
        listWorkflowRunsForRepo: async () => ({
          data: {
            workflow_runs: runs.map(({ path, status, conclusion }) => ({
              id: RUN_IDS.indexOf(path) + 1,
              name: path,
              path,
              event: 'pull_request',
              status,
              conclusion,
            })),
          },
        }),
        listJobsForWorkflowRun: async ({ run_id }: { run_id: number }) => {
          const run = runs.find((r) => RUN_IDS.indexOf(r.path) + 1 === run_id);
          return {
            data: {
              jobs: (run?.jobs ?? []).map((name, i) => ({
                id: i + 1,
                name,
                status: 'completed',
                conclusion: run?.conclusion ?? null,
              })),
            },
          };
        },
      },
    },
  } as unknown as MonitorParams['github'];
}

async function gate(observed: Observed[]): Promise<string[]> {
  const failures: string[] = [];
  await monitor({
    github: octokit(observed),
    predictClient: predictClient(),
    context: {
      repo: { owner: 'o', repo: 'r' },
      payload: { action: 'synchronize', pull_request: { number: 5, head: { sha: HEAD } } },
    } as unknown as MonitorParams['context'],
    core: { setFailed: (m: string) => failures.push(m) } as unknown as MonitorParams['core'],
    executor,
  });
  return failures;
}

const release = (conclusion: string): Observed => ({
  path: RELEASE,
  conclusion,
  jobs: ['lint', 'plan', 'build (0.4.83)'],
});
const tests = (jobs = ['unit']): Observed => ({ path: TESTS, conclusion: 'success', jobs });

beforeEach(() => {
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF}@refs/pull/5/merge`;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.GITHUB_WORKFLOW_REF;
  vi.restoreAllMocks();
});

test('a finished run whose executed matrix drifted since passes on its own conclusion', async () => {
  expect(await gate([release('success'), tests()])).toEqual([]);
});

test('the drifted run failing still fails the gate, naming it', async () => {
  const failures = await gate([release('failure'), tests()]);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toContain(`${RELEASE} (failure)`);
  expect(failures[0]).not.toContain('Unpredicted');
});

test('an unpredicted check in a workflow that executes nothing is still red', async () => {
  const failures = await gate([release('success'), tests(['unit', 'rogue'])]);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toContain(`${TESTS} :: rogue`);
  expect(failures[0]).not.toContain('0.4.83');
});
