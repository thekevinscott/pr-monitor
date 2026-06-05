import { beforeEach, describe, expect, test, vi } from 'vitest';
import { monitor, type MonitorParams } from './monitor';

type CheckRun = {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion:
    | 'success'
    | 'failure'
    | 'cancelled'
    | 'timed_out'
    | 'skipped'
    | 'neutral'
    | 'action_required'
    | 'stale'
    | null;
};

const DEFAULT_ENV: Record<string, string> = {
  JOB_NAME: 'Gate',
  EXCLUDED_JOBS: '',
  PRE_SLEEP: '0',
  CHECK_INTERVAL: '0',
  TIMEOUT: '5',
  MINIMUM_CHECKS: '1',
};

function setEnv(overrides: Record<string, string | undefined> = {}) {
  for (const key of Object.keys(DEFAULT_ENV)) {
    delete process.env[key];
  }
  const merged: Record<string, string | undefined> = { ...DEFAULT_ENV, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function makeContext(payload: Record<string, unknown> = {}, sha = 'abc123'): MonitorParams['context'] {
  return {
    repo: { owner: 'o', repo: 'r' },
    sha,
    payload,
  } as unknown as MonitorParams['context'];
}

function makeGithub(sequence: CheckRun[][], onCall?: (ref: string) => void): MonitorParams['github'] {
  let i = 0;
  return {
    rest: {
      checks: {
        listForRef: async ({ ref }: { ref: string }) => {
          onCall?.(ref);
          const runs = sequence[Math.min(i, sequence.length - 1)];
          i++;
          return { data: { check_runs: runs } };
        },
      },
    },
  } as unknown as MonitorParams['github'];
}

function makeCore() {
  return { setFailed: vi.fn() } as unknown as MonitorParams['core'] & { setFailed: ReturnType<typeof vi.fn> };
}

const gateInProgress: CheckRun = { name: 'Gate', status: 'in_progress', conclusion: null };

async function run(
  sequence: CheckRun[][],
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

describe('conclusion handling', () => {
  test('success → passes', async () => {
    const failures = await run([[
      gateInProgress,
      { name: 'Test', status: 'completed', conclusion: 'success' },
    ]]);
    expect(failures).toEqual([]);
  });

  test('skipped → passes', async () => {
    const failures = await run([[
      gateInProgress,
      { name: 'Test', status: 'completed', conclusion: 'skipped' },
    ]]);
    expect(failures).toEqual([]);
  });

  test.each(['failure', 'cancelled', 'timed_out', 'neutral', 'action_required', 'stale'] as const)(
    '%s → fails',
    async (conclusion) => {
      const failures = await run([[
        gateInProgress,
        { name: 'Test', status: 'completed', conclusion },
      ]]);
      expect(failures[0]).toMatch(new RegExp(`Test \\(${conclusion}\\)`));
    },
  );

  test('null conclusion on completed check fails (treats as non-passing)', async () => {
    const failures = await run([[
      gateInProgress,
      { name: 'Test', status: 'completed', conclusion: null },
    ]]);
    expect(failures[0]).toMatch(/Test \(null\)/);
  });

  test('multiple non-passing checks all reported', async () => {
    const failures = await run([[
      gateInProgress,
      { name: 'A', status: 'completed', conclusion: 'cancelled' },
      { name: 'B', status: 'completed', conclusion: 'timed_out' },
    ]]);
    expect(failures[0]).toMatch(/A \(cancelled\)/);
    expect(failures[0]).toMatch(/B \(timed_out\)/);
  });
});

describe('status handling', () => {
  test.each(['in_progress', 'queued', 'waiting', 'requested', 'pending'] as const)(
    '%s → still waiting',
    async (status) => {
      const failures = await run(
        [[gateInProgress, { name: 'Test', status, conclusion: null }]],
        { TIMEOUT: '0' },
      );
      expect(failures[0]).toMatch(/Still in progress.*Test/);
    },
  );

  test('in_progress → success transition passes', async () => {
    const failures = await run([
      [gateInProgress, { name: 'Test', status: 'in_progress', conclusion: null }],
      [gateInProgress, { name: 'Test', status: 'completed', conclusion: 'success' }],
    ]);
    expect(failures).toEqual([]);
  });
});

describe('minimum-checks', () => {
  test('default 1 with zero other checks fails on timeout', async () => {
    const failures = await run([[gateInProgress]], { TIMEOUT: '0' });
    expect(failures[0]).toMatch(/Only 0\/1 required checks appeared/);
  });

  test('0 with zero other checks → docs-only PR passes', async () => {
    const failures = await run([[gateInProgress]], { MINIMUM_CHECKS: '0' });
    expect(failures).toEqual([]);
  });

  test('3 with only 2 visible → fails on timeout', async () => {
    const failures = await run(
      [[
        gateInProgress,
        { name: 'A', status: 'completed', conclusion: 'success' },
        { name: 'B', status: 'completed', conclusion: 'success' },
      ]],
      { MINIMUM_CHECKS: '3', TIMEOUT: '0' },
    );
    expect(failures[0]).toMatch(/Only 2\/3 required checks appeared/);
  });

  test('waits and succeeds when third check appears after polling', async () => {
    const failures = await run([
      [
        gateInProgress,
        { name: 'A', status: 'completed', conclusion: 'success' },
        { name: 'B', status: 'completed', conclusion: 'success' },
      ],
      [
        gateInProgress,
        { name: 'A', status: 'completed', conclusion: 'success' },
        { name: 'B', status: 'completed', conclusion: 'success' },
        { name: 'C', status: 'completed', conclusion: 'success' },
      ],
    ], { MINIMUM_CHECKS: '3' });
    expect(failures).toEqual([]);
  });
});

describe('exclusions', () => {
  test('own JOB_NAME is excluded', async () => {
    const failures = await run([[
      gateInProgress,
      { name: 'Test', status: 'completed', conclusion: 'success' },
    ]]);
    expect(failures).toEqual([]);
  });

  test('EXCLUDED_JOBS list is honored', async () => {
    const failures = await run(
      [[
        gateInProgress,
        { name: 'Deploy', status: 'completed', conclusion: 'failure' },
        { name: 'Test', status: 'completed', conclusion: 'success' },
      ]],
      { EXCLUDED_JOBS: 'Deploy' },
    );
    expect(failures).toEqual([]);
  });

  test('EXCLUDED_JOBS handles whitespace and empty entries', async () => {
    const failures = await run(
      [[
        gateInProgress,
        { name: 'A', status: 'completed', conclusion: 'failure' },
        { name: 'B', status: 'completed', conclusion: 'failure' },
        { name: 'C', status: 'completed', conclusion: 'success' },
      ]],
      { EXCLUDED_JOBS: ' A , , B ' },
    );
    expect(failures).toEqual([]);
  });
});

describe('commit sha resolution', () => {
  test('uses PR head sha when present', async () => {
    setEnv();
    const core = makeCore();
    let usedRef = '';
    const github = makeGithub(
      [[gateInProgress, { name: 'Test', status: 'completed', conclusion: 'success' }]],
      (ref) => { usedRef = ref; },
    );
    const context = makeContext(
      { pull_request: { head: { sha: 'pr-head-sha' } } },
      'merge-commit-sha',
    );
    await monitor({ github, context, core });
    expect(usedRef).toBe('pr-head-sha');
  });

  test('falls back to context.sha when no PR', async () => {
    setEnv();
    const core = makeCore();
    let usedRef = '';
    const github = makeGithub(
      [[gateInProgress, { name: 'Test', status: 'completed', conclusion: 'success' }]],
      (ref) => { usedRef = ref; },
    );
    await monitor({ github, context: makeContext({}, 'push-sha'), core });
    expect(usedRef).toBe('push-sha');
  });

  test('falls back when pull_request lacks head', async () => {
    setEnv();
    const core = makeCore();
    let usedRef = '';
    const github = makeGithub(
      [[gateInProgress, { name: 'Test', status: 'completed', conclusion: 'success' }]],
      (ref) => { usedRef = ref; },
    );
    const context = makeContext({ pull_request: {} }, 'fallback-sha');
    await monitor({ github, context, core });
    expect(usedRef).toBe('fallback-sha');
  });
});

describe('env parsing', () => {
  test('missing env vars use defaults (PRE_SLEEP/TIMEOUT/MINIMUM_CHECKS/EXCLUDED_JOBS/JOB_NAME)', async () => {
    const failures = await run([[]], {
      PRE_SLEEP: undefined,
      CHECK_INTERVAL: undefined,
      TIMEOUT: undefined,
      MINIMUM_CHECKS: undefined,
      JOB_NAME: undefined,
      EXCLUDED_JOBS: undefined,
    });
    expect(failures).toEqual([]);
  });

  test('non-numeric env values fall back to defaults', async () => {
    const failures = await run([[gateInProgress]], {
      MINIMUM_CHECKS: 'not-a-number',
    });
    expect(failures).toEqual([]);
  });
});

describe('final result branches', () => {
  test('all-success log includes count', async () => {
    setEnv();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const core = makeCore();
    await monitor({
      github: makeGithub([[
        gateInProgress,
        { name: 'A', status: 'completed', conclusion: 'success' },
        { name: 'B', status: 'completed', conclusion: 'success' },
      ]]),
      context: makeContext(),
      core,
    });
    expect(logSpy).toHaveBeenCalledWith('All 2 checks completed successfully');
  });

  test('docs-only PR log emitted when minimum-checks=0 and no other checks', async () => {
    setEnv({ MINIMUM_CHECKS: '0' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const core = makeCore();
    await monitor({
      github: makeGithub([[gateInProgress]]),
      context: makeContext(),
      core,
    });
    expect(logSpy).toHaveBeenCalledWith(
      'No other workflows to monitor (minimum-checks is 0) - treating as docs-only PR',
    );
  });
});

describe('progress log', () => {
  test('logs both waiting-for-checks and in-progress when both apply', async () => {
    setEnv({ MINIMUM_CHECKS: '3', TIMEOUT: '5' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const core = makeCore();
    await monitor({
      github: makeGithub([
        [gateInProgress, { name: 'A', status: 'in_progress', conclusion: null }],
        [
          gateInProgress,
          { name: 'A', status: 'completed', conclusion: 'success' },
          { name: 'B', status: 'completed', conclusion: 'success' },
          { name: 'C', status: 'completed', conclusion: 'success' },
        ],
      ]),
      context: makeContext(),
      core,
    });
    const messages = logSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('waiting for checks') && m.includes('in progress'))).toBe(true);
  });
});
