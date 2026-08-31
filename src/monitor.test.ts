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
const CALLER = '.github/workflows/caller.yml';
const GATED = '.github/workflows/gated.yml';
const PINNED = '.github/workflows/pinned.yml';
const SCAN = '.github/workflows/scan.yml';
const HEAD_SHA = 'head-sha';

/**
 * The base branch, its tip, and the PR's test merge commit. GitHub evaluates a
 * `pull_request` at the test merge rather than the head, so willfire reads that
 * commit — and walks its first parent to tell a plain PR from a stacked one.
 */
const BASE_REF = 'main';
const BASE_SHA = 'base-sha';
const MERGE_SHA = 'merge-sha';

/** The repo the caller's `uses:` reaches into, and the mutable tag it names. */
const CALLEE_REPO = 'shared';
const CALLEE_PATH = '.github/workflows/reusable.yml';
const CALLEE_TAG = 'v0';


// ------------------------------------------------------------------ fixtures

const step = '    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n';

const wf = (name: string, jobs: string, on = 'on: pull_request') =>
  `name: ${name}\n${on}\njobs:\n${jobs}`;

const plainJob = (id: string) => `  ${id}:\n${step}`;

/**
 * One optional string input, declared identically on both sides of a call.
 *
 * `default:` is here because real workflows write one, not because it decides
 * anything: a `pull_request` is neither a dispatch nor a call, so no default is
 * ever applied and every declared input reads as the empty string.
 */
const VERSION_INPUT =
  "    inputs:\n      version:\n        type: string\n        required: false\n        default: ''";

/** A root trigger that also declares an input, and the call side of the same. */
const DISPATCH_ON = `on:\n  pull_request:\n  workflow_dispatch:\n${VERSION_INPUT}`;
const CALL_ON = `on:\n  workflow_call:\n${VERSION_INPUT}`;

/**
 * A job gated on `version` being set, over a static matrix.
 *
 * The `if:` is what makes this fixture load-bearing. On a `pull_request`
 * `inputs.version` is empty, so the job skips — and a skipped job never expands
 * its matrix, collapsing to one check under the bare job name. Leave `inputs`
 * unbound instead and the `if:` is undecidable, the matrix expands, and the same
 * workflow predicts `(a)` and `(b)` rather than the one name GitHub creates.
 */
const gatedJob = (id: string) =>
  `  ${id}:\n    if: inputs.version != ''\n    strategy:\n      matrix:\n        leg: [a, b]\n${step}`;

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
  // a cross-repo `uses:` pinned to a moving tag — the only shape whose
  // prediction can go stale without the PR changing
  [CALLER]: wf('Caller', `  call:\n    uses: o/${CALLEE_REPO}/${CALLEE_PATH}@${CALLEE_TAG}\n`),
  // matrix built from another job's output → reading alone cannot name the
  // checks; an execution grant for `setup` resolves them (real steps, real bash)
  [DYNAMIC]: wf(
    'Dynamic',
    `  setup:\n    runs-on: ubuntu-latest\n    outputs:\n      matrix: \${{ steps.emit.outputs.matrix }}\n    steps:\n      - id: emit\n        run: echo 'matrix=["x"]' >> "$GITHUB_OUTPUT"\n` +
      `  spread:\n    needs: setup\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        leg: \${{ fromJSON(needs.setup.outputs.matrix) }}\n    steps:\n      - run: echo hi\n`,
  ),
  // a root workflow that declares its own `inputs` and reads them in a job's
  // `if:` — the context a `pull_request` binds empty rather than leaves unset
  [GATED]: wf('Gated', gatedJob('guard'), DISPATCH_ON),
  // the same input, one call further down: the root declares it, the caller job
  // hands it to a reusable workflow, and the callee's `if:` is what reads it
  [PINNED]: wf(
    'Pinned',
    `  detect:\n    uses: ./${SCAN}\n    with:\n      version: \${{ inputs.version }}\n`,
    DISPATCH_ON,
  ),
  [SCAN]: wf('Scan', gatedJob('scan_hermetic'), CALL_ON),
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

/**
 * The callee program at each commit `v0` can name. Moving the tag swaps the
 * jobs the reusable workflow defines, so the checks the caller reports change
 * with it — the same divergence a caller would see with nothing wrong on
 * either side.
 */
const CALLEE_AT: Record<string, string> = {
  'callee-a': wf('Reusable', plainJob('alpha') + plainJob('extra'), 'on:\n  workflow_call:'),
  'callee-b': wf('Reusable', plainJob('alpha'), 'on:\n  workflow_call:'),
  'callee-c': wf('Reusable', plainJob('alpha') + plainJob('gamma'), 'on:\n  workflow_call:'),
};

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
  [CALLER]: ['call / alpha', 'call / extra'],
  // one check each, concluded `skipped` — GitHub creates the check for a job it
  // skips, under the bare name, with no matrix parenthetical
  [GATED]: ['guard'],
  [PINNED]: ['detect / scan_hermetic'],
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
  /** Stands in for willfire's live executor; see `MonitorParams.executor`. */
  executor?: MonitorParams['executor'];
  /** The event's `action` field; absent by default, as in the other fixtures. */
  eventAction?: string;
  /**
   * The commits `CALLEE_TAG` resolves to, one per resolution, the last
   * repeating. A second, different entry is a tag move between the prediction
   * and the re-resolution; `null` is a ref that stops resolving at all.
   */
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

/** The gate's own run — same workflow file the action is executing from. */
const self = run(SELF_PATH, { id: SELF_RUN_ID, status: 'in_progress', conclusion: null });

function makeGithub(
  scenario: Scenario,
  counter: { polls: number; predicts: number } = { polls: 0, predicts: 0 },
) {
  const paths = scenario.workflows ?? [SELF_PATH, TESTS];
  // One entry consumed per resolution of the callee tag, so a scenario can say
  // "it answered A, then B" without knowing who asked or when.
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
        // The test merge sits on the base tip, which is what makes this fixture
        // a plain PR rather than a stacked one.
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
        // Only the callee tag moves. Everything else is asked for by commit and
        // answers as itself, so the sequence below stays keyed to the thing
        // under test rather than to however many refs willfire happens to
        // resolve on the way — which changed in 0.1.31.
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
        // Callee files are served by the commit that named them, so a moved tag
        // hands back a different program.
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
  /** How many times the gate predicted; a reconciliation is the second. */
  predicts: number;
  /** Everything the gate logged, joined — provenance and moves are reported here. */
  log: string;
}

/** Run the gate; report what it failed on, said, and how far it got. */
async function gate(scenario: Scenario): Promise<GateResult> {
  const setFailed = vi.fn();
  const counter = { polls: 0, predicts: 0 };
  const github = makeGithub(scenario, counter);
  await monitor({
    github,
    // The fake already answers in willfire's shape — raw text from
    // `getContent`, unwrapped list endpoints — so one object serves both roles
    // here. In production they are two different clients; see `run.ts`.
    predictClient: github as unknown as MonitorParams['predictClient'],
    context: makeContext(scenario.eventAction),
    core: { setFailed } as unknown as MonitorParams['core'],
    execute: scenario.execute ?? [],
    executor: scenario.executor,
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
    // Same workflow as above; the grant lets willfire run `setup`, so `spread`
    // expands and the gate requires the leg by name. What running means is the
    // seam: willfire's own executor clones and shells out to docker, so the
    // stub stands where `setup` would have written to `$GITHUB_OUTPUT`.
    const { failures, polls } = await gate({
      workflows: [SELF_PATH, DYNAMIC],
      execute: [{ repo: 'o/r', jobs: ['setup'] }],
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
      execute: [],
    });
    expect(setFailed.mock.calls[0]?.[0]).toMatch(/pull request/);
  });
});

describe("a root workflow's own inputs", () => {
  // Regression guard for the willfire 0.1.30 break of 2026-08-30, which froze
  // testing-conventions for ~12 hours behind `Unresolvable check names`. A root
  // workflow's `inputs` context was left unset rather than bound, so anything
  // reading `inputs.*` — directly, or after a caller passed it down a `with:` —
  // was undecidable. Fixed in 0.1.31 and adopted in #27; these fixtures are what
  // would stop a later bump reintroducing it and still going green here.
  //
  // Both assert the resolved names, not just that the gate passed: an
  // undecidable `if:` still produces a *named* entry, and `expectedChecks`
  // deliberately expects a named entry whatever its status. The name is where
  // the difference shows — a skipped job collapses its matrix, an undecidable
  // one does not.

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
    // The incident's own shape: the root declares `version`, the caller job
    // interpolates it into `with:`, and the callee job's `if:` reads it on the
    // other side of the call. Unbound at the root, the UNKNOWN travels the whole
    // way and lands on the callee's `if:`.
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
    // "willfire said these checks" is only reconcilable against a run if it also
    // says which commits it read to say it.
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
    // Predicted against callee-a (alpha only after the tag moved off it is not
    // the point) — the tag moved to callee-c, which adds `gamma`. GitHub
    // scheduled the new program; willfire described the old one. Nobody erred.
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
    // The mirror case, and the one the terminal path sees: callee-a defines
    // `extra`, callee-b does not, so the predicted name simply never reports.
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
    // The tag resolves to the same commit it did at prediction time, so the
    // extra check is real divergence. Re-predicting would execute granted jobs
    // a second time for no reason.
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
    // callee-c adds `gamma`, but `rogue` is in neither program. Reconciling once
    // is not a licence to keep looking until something agrees.
    const { failures } = await gate({
      ...caller,
      refShas: ['callee-a', 'callee-c', 'callee-c'],
      checks: { [CALLER]: ['call / alpha', 'call / gamma', 'call / rogue'] },
      polls: [[self, run(CALLER)]],
    });
    expect(failures[0]).toMatch(/rogue/);
  });

  test('a ref that stops resolving -> red, never green', async () => {
    // Deleted tag, rate limit, network. The gate cannot name the commits behind
    // its own answer, so it fails closed rather than assuming nothing moved.
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

describe('the execute input as the execution switch', () => {
  // willfire 0.1.31 runs jobs by default. What keeps that from reaching every
  // consumer is `monitor` passing `executor: null` when nothing was granted,
  // so these pin the switch rather than the prediction it feeds.
  const logged = () =>
    vi.mocked(console.log).mock.calls.map((c) => String(c[0]));

  const GRANT = [{ repo: 'o/r', jobs: ['detect'] }];
  // These fixtures have no dynamic matrix, so nothing should ask to run. The
  // stub is here so that if something ever does, it fails in-process instead
  // of reaching for the network the way willfire's live executor would.
  const NEVER_CALLED: MonitorParams['executor'] = {
    executeJob: async (jobId: string) => ({ ok: false, reason: `unexpected execution of ${jobId}` }),
  };

  test('a grant turns execution on and names the repo it came from', async () => {
    await gate({ polls: [[self, run(TESTS)]], execute: GRANT, executor: NEVER_CALLED });
    expect(logged()).toContainEqual(
      expect.stringContaining('Execution enabled by the execute input for: o/r'),
    );
  });

  test('naming a job no longer restricts execution to it, and the log says so', async () => {
    await gate({ polls: [[self, run(TESTS)]], execute: GRANT, executor: NEVER_CALLED });
    expect(logged()).toContainEqual(
      expect.stringContaining('no longer restricts which jobs run'),
    );
  });

  test('no grant leaves execution off, silently', async () => {
    await gate({ polls: [[self, run(TESTS)]] });
    expect(logged()).not.toContainEqual(expect.stringContaining('Execution enabled'));
  });
});
