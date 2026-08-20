import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { monitor } from './monitor';
import type { WorkflowRunSummary, MonitorParams } from './types';

const SELF_RUN_ID = 999;
const SELF_PATH = '.github/workflows/pr-monitor.yml';
const HEAD_SHA = 'head-sha';

// ------------------------------------------------------------------ fixtures

const wf = (name: string, on = 'on: pull_request') =>
  `name: ${name}\n${on}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n`;

const YAML: Record<string, string> = {
  [SELF_PATH]: wf('PR Monitor'),
  '.github/workflows/test.yml': wf('Tests'),
  '.github/workflows/conventions.yml': wf('Conventions'),
  // paths filter that no fixture PR touches → willfire predicts `no-dispatch`
  '.github/workflows/docs.yml': wf('Docs', 'on:\n  pull_request:\n    paths:\n      - docs/**'),
};

const ALL_WORKFLOWS = Object.keys(YAML);

interface Scenario {
  /** Workflow files the repo exposes; defaults to the gate plus Tests. */
  workflows?: string[];
  /** Files the PR changes. */
  files?: string[];
  /** Head commit message — carries `[skip ci]` in the skip case. */
  message?: string;
  /** One entry per poll; the last entry repeats. */
  polls: WorkflowRunSummary[][];
}

function run(
  path: string,
  over: Partial<WorkflowRunSummary> = {},
): WorkflowRunSummary {
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
  const paths = scenario.workflows ?? [SELF_PATH, '.github/workflows/test.yml'];
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
    },
    actions: {
      listRepoWorkflows: async () => ({
        data: paths.map((path) => ({ path, state: 'active' })),
      }),
      listWorkflowRunsForRepo: list,
    },
  };
  return {
    rest,
    paginate: async (fn: (p: unknown) => Promise<{ data: unknown }>, params: unknown) =>
      (await fn(params)).data,
  } as unknown as MonitorParams['github'];
}

function makeContext(): MonitorParams['context'] {
  return {
    repo: { owner: 'o', repo: 'r' },
    sha: 'merge-sha',
    payload: { pull_request: { number: 5, head: { sha: HEAD_SHA } } },
    runId: SELF_RUN_ID,
  } as unknown as MonitorParams['context'];
}

/** Run the gate; report what it failed on and how many times it polled. */
async function gate(scenario: Scenario): Promise<{ failures: string[]; polls: number }> {
  const setFailed = vi.fn();
  const counter = { polls: 0 };
  await monitor({
    github: makeGithub(scenario, counter),
    context: makeContext(),
    core: { setFailed } as unknown as MonitorParams['core'],
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

describe('predicted run set', () => {
  const TESTS = '.github/workflows/test.yml';
  const CONVENTIONS = '.github/workflows/conventions.yml';
  const DOCS = '.github/workflows/docs.yml';

  test('every predicted run present and green -> pass', async () => {
    const { failures, polls } = await gate({ polls: [[self, run(TESTS)]] });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('waits for a predicted run that has not registered yet', async () => {
    // Poll 1 shows only the gate. The old minimum-checks heuristic settles green
    // here; with a prediction in hand, Tests is known to be coming and is waited on.
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

  test('[skip ci] head commit -> nothing predicted, nothing required', async () => {
    const { failures } = await gate({ message: 'docs tweak [skip ci]', polls: [[self]] });
    expect(failures).toEqual([]);
  });

  test("the gate's own workflow is neither required nor unexpected", async () => {
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
    });
    expect(setFailed.mock.calls[0]?.[0]).toMatch(/pull request/);
  });
});
