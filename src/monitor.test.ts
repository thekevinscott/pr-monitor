import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { monitor } from './monitor';
import type { WorkflowRunSummary, MonitorParams } from './types';

const SELF_RUN_ID = 999;

const DEFAULT_ENV: Record<string, string> = {
  JOB_NAME: 'Gate',
  EXCLUDED_JOBS: '',
  PRE_SLEEP: '0',
  CHECK_INTERVAL: '0',
  TIMEOUT: '5',
  MINIMUM_CHECKS: '1',
};

const ENV_KEYS = [...Object.keys(DEFAULT_ENV), 'ACTION_START_MS'] as const;

function setEnv(overrides: Record<string, string | undefined> = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries({ ...DEFAULT_ENV, ...overrides })) {
    if (v !== undefined) process.env[k] = v;
  }
}

function makeContext(
  payload: Record<string, unknown> = {},
  sha = 'abc123',
  runId = SELF_RUN_ID,
): MonitorParams['context'] {
  return { repo: { owner: 'o', repo: 'r' }, sha, payload, runId } as unknown as MonitorParams['context'];
}

function makeGithub(sequence: WorkflowRunSummary[][]): MonitorParams['github'] {
  let i = 0;
  return {
    rest: {
      actions: {
        listWorkflowRunsForRepo: async () => {
          const runs = sequence[Math.min(i, sequence.length - 1)];
          i++;
          return { data: { total_count: runs.length, workflow_runs: runs } };
        },
      },
    },
  } as unknown as MonitorParams['github'];
}

function makeCore() {
  return { setFailed: vi.fn() } as unknown as MonitorParams['core'] & { setFailed: ReturnType<typeof vi.fn> };
}

// The gate's own run: its id matches context.runId so it is excluded by id.
const gate: WorkflowRunSummary = { id: SELF_RUN_ID, name: 'Gate', status: 'in_progress', conclusion: null };

async function run(
  sequence: WorkflowRunSummary[][],
  envOverrides: Record<string, string | undefined> = {},
  context = makeContext(),
) {
  setEnv(envOverrides);
  const core = makeCore();
  await monitor({ github: makeGithub(sequence), context, core });
  return core.setFailed.mock.calls.map((c) => c[0] as string);
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('end-to-end', () => {
  test('all-success → no failures', async () => {
    expect(await run([[gate, { id: 1, name: 'T', status: 'completed', conclusion: 'success' }]])).toEqual([]);
  });

  test('cancelled run (dirsql regression) → failure', async () => {
    const failures = await run([[gate, { id: 1, name: 'Docs', status: 'completed', conclusion: 'cancelled' }]]);
    expect(failures[0]).toMatch(/Docs \(cancelled\)/);
  });

  test('own run is excluded by runId even when its name is not in excluded-jobs', async () => {
    // self run named 'CI Gate' (not 'Gate'), JOB_NAME cleared → only the id can exclude it
    const selfNamed: WorkflowRunSummary = { id: SELF_RUN_ID, name: 'CI Gate', status: 'in_progress', conclusion: null };
    expect(await run([[selfNamed]], { JOB_NAME: '', MINIMUM_CHECKS: '0' })).toEqual([]);
  });

  test('zero relevant runs + minimum-checks=1 → timeout failure (gate-green-before-tests regression)', async () => {
    const failures = await run([[gate]], { TIMEOUT: '0' });
    expect(failures[0]).toMatch(/Only 0\/1 required workflow runs appeared/);
  });

  test('zero relevant runs + minimum-checks=0 → docs-only pass', async () => {
    expect(await run([[gate]], { MINIMUM_CHECKS: '0' })).toEqual([]);
  });

  test('in-progress → completed transition via polling', async () => {
    expect(
      await run([
        [gate, { id: 1, name: 'T', status: 'in_progress', conclusion: null }],
        [gate, { id: 1, name: 'T', status: 'completed', conclusion: 'success' }],
      ]),
    ).toEqual([]);
  });

  test('run that registers late (needs-gated) is caught after a lull', async () => {
    // The race the fix closes: at poll 1 only the fast run exists and it is already done;
    // a dependent run appears at poll 2. Because the parent run stays in_progress, the loop
    // keeps polling instead of declaring green at poll 1.
    expect(
      await run([
        [gate, { id: 1, name: 'Fast', status: 'completed', conclusion: 'success' }, { id: 2, name: 'Heavy', status: 'in_progress', conclusion: null }],
        [gate, { id: 1, name: 'Fast', status: 'completed', conclusion: 'success' }, { id: 2, name: 'Heavy', status: 'completed', conclusion: 'failure' }],
      ]),
    ).toEqual([expect.stringMatching(/Heavy \(failure\)/)]);
  });

  test('stuck in_progress → timeout failure', async () => {
    const failures = await run(
      [[gate, { id: 1, name: 'T', status: 'in_progress', conclusion: null }]],
      { TIMEOUT: '0' },
    );
    expect(failures[0]).toMatch(/Still in progress.*T/);
  });

  test('resolves PR head sha for the API call', async () => {
    setEnv();
    const core = makeCore();
    let usedSha = '';
    const github = {
      rest: {
        actions: {
          listWorkflowRunsForRepo: async ({ head_sha }: { head_sha: string }) => {
            usedSha = head_sha;
            return {
              data: {
                total_count: 2,
                workflow_runs: [gate, { id: 1, name: 'T', status: 'completed', conclusion: 'success' }],
              },
            };
          },
        },
      },
    } as unknown as MonitorParams['github'];
    await monitor({
      github,
      context: makeContext({ pull_request: { head: { sha: 'pr-sha' } } }, 'merge-sha'),
      core,
    });
    expect(usedSha).toBe('pr-sha');
  });
});

describe('pre-sleep absorption of setup time', () => {
  function mockSetTimeoutImmediate() {
    return vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
      cb();
      return 0;
    }) as unknown as typeof setTimeout);
  }

  const success: WorkflowRunSummary[][] = [[gate, { id: 1, name: 'T', status: 'completed', conclusion: 'success' }]];

  test('ACTION_START_MS in the past → pre-sleep is reduced to 0 when setup exceeded it', async () => {
    setEnv({ PRE_SLEEP: '10', ACTION_START_MS: String(Date.now() - 12_000) });
    const setTimeoutSpy = mockSetTimeoutImmediate();
    await monitor({ github: makeGithub(success), context: makeContext(), core: makeCore() });
    expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(0);
    setTimeoutSpy.mockRestore();
  });

  test('ACTION_START_MS recent → pre-sleep reduced by elapsed setup time', async () => {
    setEnv({ PRE_SLEEP: '10', ACTION_START_MS: String(Date.now() - 3_000) });
    const setTimeoutSpy = mockSetTimeoutImmediate();
    await monitor({ github: makeGithub(success), context: makeContext(), core: makeCore() });
    const slept = setTimeoutSpy.mock.calls[0]?.[1] as number;
    expect(slept).toBeGreaterThanOrEqual(6_900);
    expect(slept).toBeLessThanOrEqual(7_000);
    setTimeoutSpy.mockRestore();
  });

  test('no ACTION_START_MS → full pre-sleep is used', async () => {
    setEnv({ PRE_SLEEP: '7' });
    const setTimeoutSpy = mockSetTimeoutImmediate();
    await monitor({ github: makeGithub(success), context: makeContext(), core: makeCore() });
    expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(7_000);
    setTimeoutSpy.mockRestore();
  });
});
