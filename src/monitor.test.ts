import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { monitor } from './monitor';
import type { WorkflowRunSummary, MonitorParams } from './types';

const SELF_RUN_ID = 999;
const SELF_PATH = '.github/workflows/pr-monitor.yml';
const TESTS = '.github/workflows/test.yml';
const CONVENTIONS = '.github/workflows/conventions.yml';
const DOCS = '.github/workflows/docs.yml';
const LEGS = '.github/workflows/legs.yml';
const DYNAMIC = '.github/workflows/dynamic.yml';
const REOPEN = '.github/workflows/reopen.yml';
const HEAD_SHA = 'head-sha';

// ------------------------------------------------------------------ fixtures

const step = '    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';

const wf = (name: string, jobs: string, on = 'on: pull_request') =>
  `name: ${name}\n${on}\njobs:\n${jobs}`;

const plainJob = (id: string) => `  ${id}:\n${step}`;

const YAML: Record<string, string> = {
  [SELF_PATH]: wf('PR Monitor', plainJob('monitor')),
  [TESTS]: wf('Tests', plainJob('unit')),
  [CONVENTIONS]: wf('Conventions', plainJob('conventions')),
  // paths filter that no fixture PR touches → willfire predicts `no-dispatch`
  [DOCS]: wf('Docs', plainJob('docs'), 'on:\n  pull_request:\n    paths:\n      - docs/**'),
  // narrowed `types:` → the dispatch verdict depends on the real event action;
  // the fixture PR's single commit makes willfire's fallback infer `opened`
  [REOPEN]: wf('Reopen', plainJob('greet'), 'on:\n  pull_request:\n    types: [reopened]'),
  // static matrix → two check names willfire can resolve up front
  [LEGS]: wf(
    'Legs',
    `  spread:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [20, 22]\n    steps:\n      - run: echo hi\n`,
  ),
  // matrix built from another job's output → reading alone cannot name the
  // checks; an execution grant for `setup` resolves them (real steps, real bash)
  [DYNAMIC]: wf(
    'Dynamic',
    `  setup:\n    runs-on: ubuntu-latest\n    outputs:\n      matrix: \${{ steps.emit.outputs.matrix }}\n    steps:\n      - id: emit\n        run: echo 'matrix=["x"]' >> "$GITHUB_OUTPUT"\n` +
      `  spread:\n    needs: setup\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        leg: \${{ fromJSON(needs.setup.outputs.matrix) }}\n    steps:\n      - run: echo hi\n`,
  ),
};

/**
 * A one-file tree as `repos.downloadTarballArchive` serves it — single root
 * directory, gzipped tar — for the executor to materialize as the granted
 * job's working tree. The fixture jobs never read it, but execution always
 * starts from a real tree at the predicted commit.
 */
const TARBALL = Buffer.from(
  'H4sIAAAAAAAAA+3RsQrCMBDG8c4+RV4gmNMmmQU7uvgGASN1KqQp+Pi2nbToILQq+P8td9xyH3yNTrqO4aTbOqyLZZie93acvekcd9k6s/HOlMNdjIgUyi6U50HX5pCU+sSrX9Tc93+sdvtDNfuPoWDnytf9i532750tlJk9yRN/3v/5cs1diiqnGFffDgMAAAAAAAAAAAAAAADgLTfCu2JoACgAAA==',
  'base64',
);

const ALL_WORKFLOWS = Object.keys(YAML);

/** The check names each workflow's run reports, absent a scenario override. */
const CHECKS: Record<string, string[]> = {
  [SELF_PATH]: ['monitor'],
  [TESTS]: ['unit'],
  [CONVENTIONS]: ['conventions'],
  [DOCS]: ['docs'],
  [LEGS]: ['spread (20)', 'spread (22)'],
  [DYNAMIC]: ['setup', 'spread (x)'],
  [REOPEN]: ['greet'],
};

interface Scenario {
  /** Workflow files the repo exposes; defaults to the gate plus Tests. */
  workflows?: string[];
  /** Files the PR changes. */
  files?: string[];
  /** Head commit message — carries `[skip ci]` in the skip case. */
  message?: string;
  /** Check names a workflow's run reports, overriding `CHECKS`. */
  checks?: Record<string, string[]>;
  /** Execution grants handed to the gate; nothing is granted by default. */
  execute?: MonitorParams['execute'];
  /** The event's `action` field; absent by default, as in the other fixtures. */
  eventAction?: string;
  /** One entry per poll; the last entry repeats. */
  polls: WorkflowRunSummary[][];
}

function run(path: string, over: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary {
  return {
    id: ALL_WORKFLOWS.indexOf(path) + 1,
    name: path,
    path,
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    ...over,
  };
}

/** The gate's own run — same workflow file the action is executing from. */
const self = run(SELF_PATH, { id: SELF_RUN_ID, status: 'in_progress', conclusion: null });

function makeGithub(scenario: Scenario, counter: { polls: number } = { polls: 0 }) {
  const paths = scenario.workflows ?? [SELF_PATH, TESTS];
  const list = async () => {
    const runs = scenario.polls[Math.min(counter.polls, scenario.polls.length - 1)];
    counter.polls++;
    return { data: { total_count: runs.length, workflow_runs: runs } };
  };
  const rest = {
    pulls: {
      get: async () => ({
        data: { commits: 1, base: { ref: 'main' }, head: { sha: HEAD_SHA } },
      }),
      listFiles: async () => ({
        data: (scenario.files ?? ['src/index.ts']).map((filename) => ({ filename })),
      }),
    },
    repos: {
      getCommit: async () => ({
        data: { commit: { message: scenario.message ?? 'a normal commit' } },
      }),
      getContent: async ({ path }: { path: string }) => {
        if (!(path in YAML)) throw new Error(`404 ${path}`);
        return { data: YAML[path] };
      },
      downloadTarballArchive: async () => ({ data: TARBALL }),
    },
    actions: {
      listRepoWorkflows: async () => ({
        data: paths.map((path) => ({ path, state: 'active' })),
      }),
      listWorkflowRunsForRepo: list,
      listJobsForWorkflowRun: async ({ run_id }: { run_id: number }) => {
        const path = run_id === SELF_RUN_ID ? SELF_PATH : (ALL_WORKFLOWS[run_id - 1] ?? '');
        const names = scenario.checks?.[path] ?? CHECKS[path] ?? [];
        return {
          data: {
            total_count: names.length,
            jobs: names.map((name, i) => ({
              id: i + 1,
              name,
              status: 'completed',
              conclusion: 'success',
            })),
          },
        };
      },
    },
  };
  return {
    rest,
    paginate: async (fn: (p: unknown) => Promise<{ data: unknown }>, params: unknown) =>
      (await fn(params)).data,
  } as unknown as MonitorParams['github'];
}

function makeContext(eventAction?: string): MonitorParams['context'] {
  return {
    repo: { owner: 'o', repo: 'r' },
    sha: 'merge-sha',
    payload: { action: eventAction, pull_request: { number: 5, head: { sha: HEAD_SHA } } },
    runId: SELF_RUN_ID,
  } as unknown as MonitorParams['context'];
}

/** Run the gate; report what it failed on and how many times it polled. */
async function gate(scenario: Scenario): Promise<{ failures: string[]; polls: number }> {
  const setFailed = vi.fn();
  const counter = { polls: 0 };
  await monitor({
    github: makeGithub(scenario, counter),
    context: makeContext(scenario.eventAction),
    core: { setFailed } as unknown as MonitorParams['core'],
    execute: scenario.execute ?? [],
  });
  return { failures: setFailed.mock.calls.map((c) => c[0] as string), polls: counter.polls };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Collapse the poll interval so the loop runs at test speed.
  vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
    cb();
    return 0;
  }) as unknown as typeof setTimeout);
  process.env.GITHUB_WORKFLOW_REF = `o/r/${SELF_PATH}@refs/pull/5/merge`;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GITHUB_WORKFLOW_REF;
});

describe('predicted check set', () => {
  test('every predicted check present and green -> pass', async () => {
    const { failures, polls } = await gate({ polls: [[self, run(TESTS)]] });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('waits for a predicted run that has not registered yet', async () => {
    // Poll 1 shows only the gate. Tests is known to be coming, so it is waited on
    // — a check name cannot report before the run that creates its job exists.
    const { failures, polls } = await gate({
      polls: [[self], [self], [self, run(TESTS)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(3);
  });

  test('waits for a predicted run that is still in progress', async () => {
    const { failures, polls } = await gate({
      polls: [
        [self, run(TESTS, { status: 'in_progress', conclusion: null })],
        [self, run(TESTS)],
      ],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(2);
  });

  test('a predicted run that fails -> red naming it', async () => {
    const { failures } = await gate({ polls: [[self, run(TESTS, { conclusion: 'failure' })]] });
    expect(failures[0]).toMatch(/test\.yml/);
    expect(failures[0]).toMatch(/failure/);
  });

  test('a run nobody predicted -> red naming it', async () => {
    // conventions.yml is not among the repo's workflows, so no entry predicts it.
    const { failures } = await gate({ polls: [[self, run(TESTS), run(CONVENTIONS)]] });
    expect(failures[0]).toMatch(/conventions\.yml/);
  });

  test('a renamed job -> red, even though the workflow ran and went green', async () => {
    // The path-level comparison this replaced saw nothing wrong here.
    const { failures } = await gate({
      checks: { [TESTS]: ['unit-renamed'] },
      polls: [[self, run(TESTS)]],
    });
    expect(failures[0]).toMatch(/unit-renamed/);
    expect(failures[0]).toMatch(/Unpredicted check names/);
  });

  test('a matrix leg that stops expanding -> red naming the check that never reported', async () => {
    const { failures } = await gate({
      workflows: [SELF_PATH, LEGS],
      checks: { [LEGS]: ['spread (20)'] },
      polls: [[self, run(LEGS)]],
    });
    expect(failures[0]).toMatch(/spread \(22\)/);
    expect(failures[0]).toMatch(/never reported/);
  });

  test('a deleted job -> red, since its check name never reports', async () => {
    const { failures } = await gate({
      checks: { [TESTS]: [] },
      polls: [[self, run(TESTS)]],
    });
    expect(failures[0]).toMatch(/unit/);
    expect(failures[0]).toMatch(/never reported/);
  });

  test('the real event action decides a narrowed `types:` dispatch', async () => {
    // reopen.yml fires on `reopened` only. The fixture PR has one commit, so
    // willfire's fallback would infer `opened` and call the run unexpected;
    // the payload's actual action is what predicts it.
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, TESTS, REOPEN],
      eventAction: 'reopened',
      polls: [[self, run(TESTS), run(REOPEN)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('a workflow predicted no-dispatch is not required', async () => {
    // docs.yml filters on docs/**; the PR touches src/, so it must not be waited on.
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, TESTS, DOCS],
      files: ['src/index.ts'],
      polls: [[self, run(TESTS)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('a check name willfire cannot resolve -> red before the first poll', async () => {
    // A dynamic matrix leaves a hole in the predicted set. No observation fills
    // it, so the gate says so rather than polling or quietly exempting it.
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, DYNAMIC],
      polls: [[self, run(DYNAMIC)]],
    });
    expect(failures[0]).toMatch(/Unresolvable check names/);
    expect(failures[0]).toMatch(/dynamic\.yml :: spread/);
    expect(polls).toBe(0);
  });

  test('a granted job resolves the dynamic matrix and the gate keys on its legs', async () => {
    // Same workflow as above; the grant lets willfire run `setup` for real,
    // so `spread` expands and the gate requires the leg by name.
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, DYNAMIC],
      execute: [{ repo: 'o/r', jobs: ['setup'] }],
      polls: [[self, run(DYNAMIC)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('[skip ci] head commit -> nothing predicted, nothing required', async () => {
    const { failures } = await gate({ message: 'docs tweak [skip ci]', polls: [[self]] });
    expect(failures).toEqual([]);
  });

  test("the gate's own checks are neither required nor unexpected", async () => {
    const { failures, polls } = await gate({ workflows: [SELF_PATH], polls: [[self]] });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('a push-event run on the same sha is ignored, not treated as unexpected', async () => {
    const { failures } = await gate({
      polls: [[self, run(TESTS), run(CONVENTIONS, { id: 77, event: 'push' })]],
    });
    expect(failures).toEqual([]);
  });

  test('polls the PR head sha, not the merge sha', async () => {
    let usedSha = '';
    const github = makeGithub({ polls: [[self, run(TESTS)]] });
    const original = github.rest.actions.listWorkflowRunsForRepo;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (github.rest.actions as any).listWorkflowRunsForRepo = async (params: any) => {
      usedSha = params.head_sha;
      return original(params);
    };
    await monitor({
      github,
      context: makeContext(),
      core: { setFailed: vi.fn() } as unknown as MonitorParams['core'],
      execute: [],
    });
    expect(usedSha).toBe(HEAD_SHA);
  });

  test('GITHUB_WORKFLOW_REF unset -> red rather than a bad comparison', async () => {
    delete process.env.GITHUB_WORKFLOW_REF;
    const { failures, polls } = await gate({ polls: [[self, run(TESTS)]] });
    expect(failures[0]).toMatch(/GITHUB_WORKFLOW_REF/);
    expect(polls).toBe(0);
  });

  test('no pull_request payload -> red, since there is nothing to predict against', async () => {
    const setFailed = vi.fn();
    await monitor({
      github: makeGithub({ polls: [[self, run(TESTS)]] }),
      context: {
        repo: { owner: 'o', repo: 'r' },
        sha: 'merge-sha',
        payload: {},
        runId: SELF_RUN_ID,
      } as unknown as MonitorParams['context'],
      core: { setFailed } as unknown as MonitorParams['core'],
      execute: [],
    });
    expect(setFailed.mock.calls[0]?.[0]).toMatch(/pull request/);
  });
});
