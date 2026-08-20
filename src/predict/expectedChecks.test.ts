import { expect, test } from 'vitest';
import type { Entry, JobEntry, Prediction, WorkflowEntry } from 'willfire';
import { expectedChecks } from './expectedChecks';

const SELF = '.github/workflows/gate.yml';

function prediction(...entries: Entry[]): Prediction {
  const checkNames = entries.flatMap((e) =>
    e.status === 'run' && e.checkName != null ? [e.checkName] : [],
  );
  return { entries, checkNames: [...new Set(checkNames)].sort(), skip: null };
}

// willfire brands job names so that `"*"` cannot be written into the job-level
// variant. The brand is a compile-time fiction — willfire's `jobName` is the
// identity at runtime — and `expectedChecks` imports willfire for types only,
// so the fixture mints one here rather than pulling a runtime collaborator into
// a unit test.
const asJobName = (id: string) => id as JobEntry['job'];

// Two builders, not one, because willfire's Entry is two variants and the whole
// point of that split is that a fixture cannot straddle them. A workflow-level
// verdict has no name and cannot be `unknown`; a job-level one carries both.
const jobEntry = (
  workflow: string,
  id: string,
  checkName: string | null,
  status: JobEntry['status'],
  reason = 'because',
): JobEntry => ({ workflow, job: asJobName(id), checkName, status, reason });

const wfEntry = (workflow: string, status: WorkflowEntry['status']): WorkflowEntry => ({
  workflow,
  job: '*',
  checkName: null,
  status,
  reason: 'because',
});

test('a resolved check name is expected, and its workflow with it', () => {
  const result = expectedChecks(prediction(jobEntry('a.yml', 'build', 'Build', 'run')), SELF);
  expect(result).toEqual({ names: ['Build'], workflows: ['a.yml'], unresolved: [] });
});

test('matrix legs are separate check names under one workflow', () => {
  const result = expectedChecks(
    prediction(
      jobEntry('a.yml', 'test', 'Test (20)', 'run'),
      jobEntry('a.yml', 'test', 'Test (22)', 'run'),
    ),
    SELF,
  );
  expect(result.names).toEqual(['Test (20)', 'Test (22)']);
  expect(result.workflows).toEqual(['a.yml']);
});

test('a skipped job still reports a check, so its name is expected', () => {
  // GitHub creates the check and concludes it `skipped`; the name shows up either way.
  const result = expectedChecks(prediction(jobEntry('a.yml', 'build', 'Build', 'skipped')), SELF);
  expect(result.names).toEqual(['Build']);
});

test('a nameable job whose run/skip is unknown is still expected by name', () => {
  const result = expectedChecks(prediction(jobEntry('a.yml', 'build', 'Build', 'unknown')), SELF);
  expect(result.names).toEqual(['Build']);
});

test('no-dispatch expects nothing at all, not even the run', () => {
  const result = expectedChecks(prediction(wfEntry('a.yml', 'no-dispatch')), SELF);
  expect(result).toEqual({ names: [], workflows: [], unresolved: [] });
});

test('a workflow-level verdict requires the run but names no check', () => {
  // willfire is speaking about the file, not a job in it — a startup_failure run
  // creates no jobs, so the run is the only thing there is to require.
  const result = expectedChecks(prediction(wfEntry('a.yml', 'run')), SELF);
  expect(result).toEqual({ names: [], workflows: ['a.yml'], unresolved: [] });
});

test('a job willfire cannot name is unresolved, and names the reason', () => {
  const result = expectedChecks(
    prediction(jobEntry('a.yml', 'test', null, 'unknown', 'dynamic matrix')),
    SELF,
  );
  expect(result.unresolved).toEqual(['a.yml :: test (dynamic matrix)']);
  expect(result.names).toEqual([]);
  // The run is still required; the gate fails on `unresolved` before polling.
  expect(result.workflows).toEqual(['a.yml']);
});

test("the gate's own workflow is dropped from every set", () => {
  const result = expectedChecks(
    prediction(jobEntry(SELF, 'monitor', 'Monitor', 'run'), jobEntry('a.yml', 'one', 'One', 'run')),
    SELF,
  );
  expect(result).toEqual({ names: ['One'], workflows: ['a.yml'], unresolved: [] });
});

test('a repeated check name is expected once', () => {
  const result = expectedChecks(
    prediction(jobEntry('a.yml', 'build', 'Build', 'run'), jobEntry('b.yml', 'build', 'Build', 'run')),
    SELF,
  );
  expect(result.names).toEqual(['Build']);
  expect(result.workflows).toEqual(['a.yml', 'b.yml']);
});

test('output is sorted for stable logs', () => {
  const result = expectedChecks(
    prediction(
      jobEntry('c.yml', 'x', 'Zed', 'run'),
      jobEntry('a.yml', 'x', 'Alpha', 'run'),
      jobEntry('b.yml', 'x', 'Mid', 'run'),
    ),
    SELF,
  );
  expect(result.names).toEqual(['Alpha', 'Mid', 'Zed']);
  expect(result.workflows).toEqual(['a.yml', 'b.yml', 'c.yml']);
});

test('an empty prediction ([skip ci]) expects nothing', () => {
  expect(expectedChecks({ entries: [], checkNames: [], skip: 'skip instruction' }, SELF)).toEqual({
    names: [],
    workflows: [],
    unresolved: [],
  });
});
