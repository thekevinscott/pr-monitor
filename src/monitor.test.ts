import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { monitor } from './monitor';
import { sleep } from './timing/sleep';
import type { WorkflowRunSummary, MonitorParams } from './types';

vi.mock('./timing/sleep', async () => {
  const actual = await vi.importActual<typeof import('./timing/sleep')>('./timing/sleep');
  return { ...actual, sleep: vi.fn(() => Promise.resolve()) };
});

// A recorder, not a mock: `predict` stays real so every scenario still exercises willfire.
const { predictSpy } = vi.hoisted(() => ({ predictSpy: vi.fn() }));

vi.mock('willfire', async () => {
  const actual = await vi.importActual<typeof import('willfire')>('willfire');
  return {
    ...actual,
    predict: (...args: Parameters<typeof actual.predict>) => {
      predictSpy(...args);
      return actual.predict(...args);
    },
  };
});

const SELF_RUN_ID = 999;
const SELF_PATH = '.github/workflows/pr-monitor.yml';
const TESTS = '.github/workflows/test.yml';
const CONVENTIONS = '.github/workflows/conventions.yml';
const DOCS = '.github/workflows/docs.yml';
const LEGS = '.github/workflows/legs.yml';
const DYNAMIC = '.github/workflows/dynamic.yml';
const REOPEN = '.github/workflows/reopen.yml';
const CALLER = '.github/workflows/caller.yml';
const GATED = '.github/workflows/gated.yml';
const PINNED = '.github/workflows/pinned.yml';
const SCAN = '.github/workflows/scan.yml';
const HEAD_SHA = 'head-sha';

const BASE_REF = 'main';
const BASE_SHA = 'base-sha';
const MERGE_SHA = 'merge-sha';

const CALLEE_REPO = 'shared';
const CALLEE_PATH = '.github/workflows/reusable.yml';
const CALLEE_TAG = 'v0';

const step = '    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';

const wf = (name: string, jobs: string, on = 'on: pull_request') =>
  `name: ${name}\n${on}\njobs:\n${jobs}`;

const plainJob = (id: string) => `  ${id}:\n${step}`;

const VERSION_INPUT =
  "    inputs:\n      version:\n        type: string\n        required: false\n        default: ''";

const DISPATCH_ON = `on:\n  pull_request:\n  workflow_dispatch:\n${VERSION_INPUT}`;
const CALL_ON = `on:\n  workflow_call:\n${VERSION_INPUT}`;

// A skipped job never expands its matrix, which is what makes the `if:` observable.
const gatedJob = (id: string) =>
  `  ${id}:\n    if: inputs.version != ''\n    strategy:\n      matrix:\n        leg: [a, b]\n${step}`;

const YAML: Record<string, string> = {
  [SELF_PATH]: wf('PR Monitor', plainJob('monitor')),
  [TESTS]: wf('Tests', plainJob('unit')),
  [CONVENTIONS]: wf('Conventions', plainJob('conventions')),
  [DOCS]: wf('Docs', plainJob('docs'), 'on:\n  pull_request:\n    paths:\n      - docs/**'),
  [REOPEN]: wf('Reopen', plainJob('greet'), 'on:\n  pull_request:\n    types: [reopened]'),
  [LEGS]: wf(
    'Legs',
    `  spread:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [20, 22]\n    steps:\n      - run: echo hi\n`,
  ),
  [CALLER]: wf('Caller', `  call:\n    uses: o/${CALLEE_REPO}/${CALLEE_PATH}@${CALLEE_TAG}\n`),
  [DYNAMIC]: wf(
    'Dynamic',
    `  setup:\n    runs-on: ubuntu-latest\n    outputs:\n      matrix: \${{ steps.emit.outputs.matrix }}\n    steps:\n      - id: emit\n        run: echo 'matrix=["x"]' >> "$GITHUB_OUTPUT"\n` +
      `  spread:\n    needs: setup\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        leg: \${{ fromJSON(needs.setup.outputs.matrix) }}\n    steps:\n      - run: echo hi\n`,
  ),
  [GATED]: wf('Gated', gatedJob('guard'), DISPATCH_ON),
  [PINNED]: wf(
    'Pinned',
    `  detect:\n    uses: ./${SCAN}\n    with:\n      version: \${{ inputs.version }}\n`,
    DISPATCH_ON,
  ),
  [SCAN]: wf('Scan', gatedJob('scan_hermetic'), CALL_ON),
};

// A one-file tree as `repos.downloadTarballArchive` serves it: single root dir, gzipped tar.
const TARBALL = Buffer.from(
  'H4sIAAAAAAAAA+3RsQrCMBDG8c4+RV4gmNMmmQU7uvgGASN1KqQp+Pi2nbToILQq+P8td9xyH3yNTrqO4aTbOqyLZZie93acvekcd9k6s/HOlMNdjIgUyi6U50HX5pCU+sSrX9Tc93+sdvtDNfuPoWDnytf9i532750tlJk9yRN/3v/5cs1diiqnGFffDgMAAAAAAAAAAAAAAADgLTfCu2JoACgAAA==',
  'base64',
);

const CALLEE_AT: Record<string, string> = {
  'callee-a': wf('Reusable', plainJob('alpha') + plainJob('extra'), 'on:\n  workflow_call:'),
  'callee-b': wf('Reusable', plainJob('alpha'), 'on:\n  workflow_call:'),
  'callee-c': wf('Reusable', plainJob('alpha') + plainJob('gamma'), 'on:\n  workflow_call:'),
};

const ALL_WORKFLOWS = Object.keys(YAML);

const CHECKS: Record<string, string[]> = {
  [SELF_PATH]: ['monitor'],
  [TESTS]: ['unit'],
  [CONVENTIONS]: ['conventions'],
  [DOCS]: ['docs'],
  [LEGS]: ['spread (20)', 'spread (22)'],
  [DYNAMIC]: ['setup', 'spread (x)'],
  [REOPEN]: ['greet'],
  [CALLER]: ['call / alpha', 'call / extra'],
  [GATED]: ['guard'],
  [PINNED]: ['detect / scan_hermetic'],
};

interface Scenario {
  workflows?: string[];
  files?: string[];
  message?: string;
  checks?: Record<string, string[]>;
  executor?: MonitorParams['executor'];
  callbacks?: MonitorParams['callbacks'];
  eventAction?: string;
  /** One entry per resolution of `CALLEE_TAG`, the last repeating; `null` stops resolving. */
  refShas?: Array<string | null>;
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

const self = run(SELF_PATH, { id: SELF_RUN_ID, status: 'in_progress', conclusion: null });

function makeGithub(
  scenario: Scenario,
  counter: { polls: number; predicts: number } = { polls: 0, predicts: 0 },
) {
  const paths = scenario.workflows ?? [SELF_PATH, TESTS];
  const refShas = scenario.refShas ?? ['callee-a'];
  let refReads = 0;
  const list = async () => {
    const runs = scenario.polls[Math.min(counter.polls, scenario.polls.length - 1)];
    counter.polls++;
    return { data: { total_count: runs.length, workflow_runs: runs } };
  };
  const rest = {
    pulls: {
      get: async () => ({
        data: {
          commits: 1,
          base: { ref: BASE_REF },
          head: { sha: HEAD_SHA },
          merge_commit_sha: MERGE_SHA,
        },
      }),
      listFiles: async () => ({
        data: (scenario.files ?? ['src/index.ts']).map((filename) => ({ filename })),
      }),
    },
    repos: {
      getCommit: async ({ ref }: { ref: string }) => {
        if (ref === MERGE_SHA) {
          return {
            data: {
              sha: MERGE_SHA,
              parents: [{ sha: BASE_SHA }],
              commit: { message: 'the test merge' },
            },
          };
        }
        if (ref === BASE_REF) {
          return { data: { sha: BASE_SHA, parents: [], commit: { message: 'the base tip' } } };
        }
        // Everything but the callee tag answers as itself, so `refShas` stays a sequence keyed to
        // the thing under test, not to how many refs willfire resolves — which changed in 0.1.31.
        if (ref !== CALLEE_TAG) {
          return {
            data: {
              sha: ref,
              parents: [],
              commit: { message: scenario.message ?? 'a normal commit' },
            },
          };
        }
        const sha = refShas[Math.min(refReads, refShas.length - 1)];
        refReads++;
        if (sha === null) throw new Error(`404 ${ref}`);
        return { data: { sha, parents: [], commit: { message: 'the callee' } } };
      },
      getContent: async ({ repo: from, path, ref }: {
        repo: string;
        path: string;
        ref: string;
      }) => {
        if (from === CALLEE_REPO) {
          if (path !== CALLEE_PATH || !(ref in CALLEE_AT)) throw new Error(`404 ${path}@${ref}`);
          return { data: CALLEE_AT[ref] };
        }
        if (!(path in YAML)) throw new Error(`404 ${path}`);
        return { data: YAML[path] };
      },
      downloadTarballArchive: async () => ({ data: TARBALL }),
    },
    actions: {
      listRepoWorkflows: async () => {
        // Read exactly once per prediction, so this counts predictions.
        counter.predicts++;
        return { data: paths.map((path) => ({ path, state: 'active' })) };
      },
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

interface GateResult {
  failures: string[];
  polls: number;
  predicts: number;
  log: string;
}

async function gate(scenario: Scenario): Promise<GateResult> {
  const setFailed = vi.fn();
  const counter = { polls: 0, predicts: 0 };
  const github = makeGithub(scenario, counter);
  await monitor({
    github,
    // The fake already answers in willfire's shape, so one object serves both roles here.
    predictClient: github as unknown as MonitorParams['predictClient'],
    context: makeContext(scenario.eventAction),
    core: { setFailed } as unknown as MonitorParams['core'],
    executor: scenario.executor,
    callbacks: scenario.callbacks,
  });
  const logged = vi.mocked(console.log).mock.calls.map((c) => String(c[0]));
  return {
    failures: setFailed.mock.calls.map((c) => c[0] as string),
    polls: counter.polls,
    predicts: counter.predicts,
    log: logged.join('\n'),
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
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
    const { failures, polls } = await gate({
      polls: [[self], [self], [self, run(TESTS)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(3);
    expect(vi.mocked(sleep)).toHaveBeenCalledWith(30_000);
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
    const { failures } = await gate({ polls: [[self, run(TESTS), run(CONVENTIONS)]] });
    expect(failures[0]).toMatch(/conventions\.yml/);
  });

  test('a renamed job -> red, even though the workflow ran and went green', async () => {
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
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, TESTS, REOPEN],
      eventAction: 'reopened',
      polls: [[self, run(TESTS), run(REOPEN)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('a workflow predicted no-dispatch is not required', async () => {
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, TESTS, DOCS],
      files: ['src/index.ts'],
      polls: [[self, run(TESTS)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('a check name execution cannot resolve -> red before the first poll', async () => {
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, DYNAMIC],
      executor: { executeJob: async () => ({ ok: false, reason: 'sandbox unavailable' }) },
      polls: [[self, run(DYNAMIC)]],
    });
    expect(failures[0]).toMatch(/Unresolvable check names/);
    expect(failures[0]).toMatch(/dynamic\.yml :: spread/);
    expect(polls).toBe(0);
  });

  test('a dynamic matrix resolves with no switch: execution is always on', async () => {
    // The stub stands where `setup` would write `$GITHUB_OUTPUT`; the live executor uses docker.
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, DYNAMIC],
      executor: {
        executeJob: async (jobId: string) =>
          jobId === 'setup'
            ? { ok: true, outputs: { matrix: '["x"]' } }
            : { ok: false, reason: `no stub for ${jobId}` },
      },
      polls: [[self, run(DYNAMIC)]],
    });
    expect(failures).toEqual([]);
    expect(polls).toBe(1);
  });

  test('resolver callbacks ride the predict options', async () => {
    const { failures } = await gate({
      callbacks: ['echo {}', 'printf {}'],
      polls: [[self, run(TESTS)]],
    });
    expect(failures).toEqual([]);
    expect(predictSpy.mock.calls.at(-1)?.[3]).toMatchObject({
      callbacks: ['echo {}', 'printf {}'],
    });
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
      predictClient: github as unknown as MonitorParams['predictClient'],
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
      predictClient: makeGithub({
        polls: [[self, run(TESTS)]],
      }) as unknown as MonitorParams['predictClient'],
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

describe("a root workflow's own inputs", () => {
  test("an input the workflow declares itself decides its own job's `if:`", async () => {
    const { failures, log, polls } = await gate({
      workflows: [SELF_PATH, GATED],
      polls: [[self, run(GATED)]],
    });
    expect(failures).toEqual([]);
    expect(log).toContain('Expected checks: ["guard"]');
    expect(polls).toBe(1);
  });

  test("an input passed down a `with:` decides the callee's `if:`", async () => {
    const { failures, log, polls } = await gate({
      workflows: [SELF_PATH, PINNED],
      polls: [[self, run(PINNED)]],
    });
    expect(failures).toEqual([]);
    expect(log).toContain('Expected checks: ["detect / scan_hermetic"]');
    expect(polls).toBe(1);
  });
});

describe('a callee tag that moves mid-flight', () => {
  const caller = { workflows: [SELF_PATH, CALLER] };

  test('records the commits the prediction was read from', async () => {
    const { failures, log } = await gate({
      ...caller,
      refShas: ['callee-a'],
      polls: [[self, run(CALLER)]],
    });
    expect(failures).toEqual([]);
    expect(log).toMatch(/o\/r@head-sha -> head-sha/);
    expect(log).toMatch(new RegExp(`o/${CALLEE_REPO}@${CALLEE_TAG} -> callee-a`));
  });

  test('a move that explains an unpredicted check -> green, naming the move', async () => {
    const { failures, log, predicts, polls } = await gate({
      ...caller,
      refShas: ['callee-b', 'callee-c', 'callee-c'],
      checks: { [CALLER]: ['call / alpha', 'call / gamma'] },
      polls: [[self, run(CALLER)]],
    });
    expect(failures).toEqual([]);
    expect(log).toMatch(/callee-b/);
    expect(log).toMatch(/callee-c/);
    expect(predicts).toBe(2);
    expect(polls).toBeGreaterThan(0);
  });

  test('a move that explains a check that never reported -> green', async () => {
    const { failures, log } = await gate({
      ...caller,
      refShas: ['callee-a', 'callee-b', 'callee-b'],
      checks: { [CALLER]: ['call / alpha'] },
      polls: [[self, run(CALLER)]],
    });
    expect(failures).toEqual([]);
    expect(log).toMatch(/callee-a/);
    expect(log).toMatch(/callee-b/);
  });

  test('nothing moved -> the divergence stands, and nothing is re-predicted', async () => {
    const { failures, predicts } = await gate({
      ...caller,
      refShas: ['callee-a'],
      checks: { [CALLER]: ['call / alpha', 'call / extra', 'call / rogue'] },
      polls: [[self, run(CALLER)]],
    });
    expect(failures[0]).toMatch(/rogue/);
    expect(failures[0]).toMatch(/Unpredicted check names/);
    expect(predicts).toBe(1);
  });

  test('a move that does not explain the divergence -> still red', async () => {
    const { failures, predicts } = await gate({
      ...caller,
      refShas: ['callee-a', 'callee-c', 'callee-c'],
      checks: { [CALLER]: ['call / alpha', 'call / gamma', 'call / rogue'] },
      polls: [[self, run(CALLER)]],
    });
    expect(failures[0]).toMatch(/rogue/);
    expect(predicts).toBe(2);
  });

  test('a ref that stops resolving -> red, never green', async () => {
    const { failures } = await gate({
      ...caller,
      refShas: ['callee-a', null],
      checks: { [CALLER]: ['call / alpha', 'call / extra', 'call / rogue'] },
      polls: [[self, run(CALLER)]],
    });
    expect(failures[0]).toMatch(new RegExp(`o/${CALLEE_REPO}@${CALLEE_TAG}`));
    expect(failures[0]).toMatch(/could not be re-resolved/);
  });
});

describe('a rate-limited read', () => {
  const RATE_LIMIT_ERROR = Object.assign(new Error('API rate limit exceeded for installation'), {
    status: 403,
    response: { headers: { 'retry-after': '30' } },
  });

  test('a rate limit fetching runs waits and resumes rather than failing', async () => {
    const github = makeGithub({ polls: [[self, run(TESTS)]] });
    const original = github.rest.actions.listWorkflowRunsForRepo;
    let calls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (github.rest.actions as any).listWorkflowRunsForRepo = async (params: any) => {
      calls++;
      if (calls === 1) throw RATE_LIMIT_ERROR;
      return original(params);
    };
    const setFailed = vi.fn();
    await monitor({
      github,
      predictClient: github as unknown as MonitorParams['predictClient'],
      context: makeContext(),
      core: { setFailed } as unknown as MonitorParams['core'],
    });
    expect(setFailed).not.toHaveBeenCalled();
    expect(vi.mocked(console.log).mock.calls.map((c) => String(c[0]))).toContainEqual(
      'GitHub API rate limited; retrying in 60s',
    );
    expect(vi.mocked(sleep)).toHaveBeenCalledWith(60_000);
  });

  test('a rate limit fetching jobs waits and resumes rather than failing', async () => {
    const github = makeGithub({ polls: [[self, run(TESTS)]] });
    const original = github.rest.actions.listJobsForWorkflowRun;
    let calls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (github.rest.actions as any).listJobsForWorkflowRun = async (params: any) => {
      calls++;
      if (calls === 1) throw RATE_LIMIT_ERROR;
      return original(params);
    };
    const setFailed = vi.fn();
    await monitor({
      github,
      predictClient: github as unknown as MonitorParams['predictClient'],
      context: makeContext(),
      core: { setFailed } as unknown as MonitorParams['core'],
    });
    expect(setFailed).not.toHaveBeenCalled();
    expect(vi.mocked(sleep)).toHaveBeenCalledWith(60_000);
  });

  test('a non-rate-limit error fetching runs is not swallowed', async () => {
    const github = makeGithub({ polls: [[self, run(TESTS)]] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (github.rest.actions as any).listWorkflowRunsForRepo = async () => {
      throw new Error('socket hang up');
    };
    await expect(
      monitor({
        github,
        predictClient: github as unknown as MonitorParams['predictClient'],
        context: makeContext(),
        core: { setFailed: vi.fn() } as unknown as MonitorParams['core'],
      }),
    ).rejects.toThrow('socket hang up');
    expect(vi.mocked(sleep)).not.toHaveBeenCalled();
  });
});
