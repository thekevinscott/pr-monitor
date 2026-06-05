const test = require('node:test');
const assert = require('node:assert');
const monitor = require('./monitor.js');

const DEFAULT_ENV = {
  JOB_NAME: 'Gate',
  EXCLUDED_JOBS: '',
  PRE_SLEEP: '0',
  CHECK_INTERVAL: '0',
  TIMEOUT: '5',
  MINIMUM_CHECKS: '1',
};

function setEnv(overrides = {}) {
  const all = { ...DEFAULT_ENV, ...overrides };
  for (const [k, v] of Object.entries(all)) {
    process.env[k] = String(v);
  }
}

function makeContext() {
  return {
    repo: { owner: 'o', repo: 'r' },
    sha: 'abc123',
    payload: {},
  };
}

function makeGithub(sequence) {
  let i = 0;
  return {
    rest: {
      checks: {
        listForRef: async () => {
          const runs = sequence[Math.min(i, sequence.length - 1)];
          i++;
          return { data: { check_runs: runs } };
        },
      },
    },
  };
}

function makeCore() {
  const failures = [];
  return {
    setFailed: (msg) => failures.push(msg),
    _failures: failures,
  };
}

const gateInProgress = { name: 'Gate', status: 'in_progress', conclusion: null };

async function run(sequence, envOverrides = {}) {
  setEnv(envOverrides);
  const core = makeCore();
  await monitor({ github: makeGithub(sequence), context: makeContext(), core });
  return core._failures;
}

test('all checks complete with success → passes', async () => {
  const failures = await run([[
    gateInProgress,
    { name: 'Test', status: 'completed', conclusion: 'success' },
  ]]);
  assert.deepStrictEqual(failures, []);
});

test('skipped conclusion counts as passing', async () => {
  const failures = await run([[
    gateInProgress,
    { name: 'Test', status: 'completed', conclusion: 'skipped' },
  ]]);
  assert.deepStrictEqual(failures, []);
});

test('cancelled conclusion fails the gate (regression: dirsql incident)', async () => {
  const failures = await run([[
    gateInProgress,
    { name: 'Docs Test', status: 'completed', conclusion: 'cancelled' },
  ]]);
  assert.strictEqual(failures.length, 1);
  assert.match(failures[0], /Docs Test \(cancelled\)/);
});

test('timed_out conclusion fails the gate', async () => {
  const failures = await run([[
    gateInProgress,
    { name: 'Test', status: 'completed', conclusion: 'timed_out' },
  ]]);
  assert.match(failures[0], /Test \(timed_out\)/);
});

test('neutral, action_required, stale all fail the gate', async () => {
  for (const conclusion of ['neutral', 'action_required', 'stale']) {
    const failures = await run([[
      gateInProgress,
      { name: 'Test', status: 'completed', conclusion },
    ]]);
    assert.match(failures[0], new RegExp(`Test \\(${conclusion}\\)`), `expected ${conclusion} to fail`);
  }
});

test('failure conclusion still fails the gate', async () => {
  const failures = await run([[
    gateInProgress,
    { name: 'Test', status: 'completed', conclusion: 'failure' },
  ]]);
  assert.match(failures[0], /Test \(failure\)/);
});

test('minimum-checks=1 with zero other checks fails on timeout (regression: gate green before tests register)', async () => {
  const failures = await run(
    [[gateInProgress]],
    { TIMEOUT: '0' }
  );
  assert.match(failures[0], /Only 0\/1 required checks appeared/);
});

test('minimum-checks=0 with zero other checks passes (docs-only PR)', async () => {
  const failures = await run(
    [[gateInProgress]],
    { MINIMUM_CHECKS: '0' }
  );
  assert.deepStrictEqual(failures, []);
});

test('minimum-checks=3 with only 2 checks visible waits then fails on timeout', async () => {
  const failures = await run(
    [[
      gateInProgress,
      { name: 'A', status: 'completed', conclusion: 'success' },
      { name: 'B', status: 'completed', conclusion: 'success' },
    ]],
    { MINIMUM_CHECKS: '3', TIMEOUT: '0' }
  );
  assert.match(failures[0], /Only 2\/3 required checks appeared/);
});

test('checks that start in_progress and later succeed → passes', async () => {
  const failures = await run([
    [gateInProgress, { name: 'Test', status: 'in_progress', conclusion: null }],
    [gateInProgress, { name: 'Test', status: 'completed', conclusion: 'success' }],
  ]);
  assert.deepStrictEqual(failures, []);
});

test('check stuck in_progress times out cleanly', async () => {
  const failures = await run(
    [[gateInProgress, { name: 'Test', status: 'in_progress', conclusion: null }]],
    { TIMEOUT: '0' }
  );
  assert.match(failures[0], /Still in progress.*Test/);
});

test('queued and waiting statuses treated as not-done', async () => {
  for (const status of ['queued', 'waiting', 'requested']) {
    const failures = await run(
      [[gateInProgress, { name: 'Test', status, conclusion: null }]],
      { TIMEOUT: '0' }
    );
    assert.match(failures[0], /Still in progress.*Test/, `expected status ${status} to be not-done`);
  }
});

test('own job-name is excluded from monitoring', async () => {
  const failures = await run([[
    { name: 'Gate', status: 'in_progress', conclusion: null },
    { name: 'Test', status: 'completed', conclusion: 'success' },
  ]]);
  assert.deepStrictEqual(failures, []);
});

test('excluded-jobs list is honored', async () => {
  const failures = await run(
    [[
      gateInProgress,
      { name: 'Deploy', status: 'completed', conclusion: 'failure' },
      { name: 'Test', status: 'completed', conclusion: 'success' },
    ]],
    { EXCLUDED_JOBS: 'Deploy' }
  );
  assert.deepStrictEqual(failures, []);
});

test('multiple non-passing checks all reported', async () => {
  const failures = await run([[
    gateInProgress,
    { name: 'A', status: 'completed', conclusion: 'cancelled' },
    { name: 'B', status: 'completed', conclusion: 'timed_out' },
  ]]);
  assert.match(failures[0], /A \(cancelled\)/);
  assert.match(failures[0], /B \(timed_out\)/);
});

test('PR head SHA preferred over context.sha', async () => {
  setEnv();
  const core = makeCore();
  let usedSha = null;
  const github = {
    rest: {
      checks: {
        listForRef: async ({ ref }) => {
          usedSha = ref;
          return { data: { check_runs: [
            gateInProgress,
            { name: 'Test', status: 'completed', conclusion: 'success' },
          ] } };
        },
      },
    },
  };
  const context = {
    repo: { owner: 'o', repo: 'r' },
    sha: 'merge-commit-sha',
    payload: { pull_request: { head: { sha: 'pr-head-sha' } } },
  };
  await monitor({ github, context, core });
  assert.strictEqual(usedSha, 'pr-head-sha');
});
