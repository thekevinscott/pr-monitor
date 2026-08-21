import { expect, test } from 'vitest';
import { compareObserved } from './compareObserved';
import type { ExpectedChecks, WorkflowJobSummary, WorkflowRunSummary } from '../types';

const run = (path: string, over: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary => ({
  id: 1,
  name: path,
  path,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  ...over,
});

const job = (
  workflowPath: string,
  name: string,
  over: Partial<WorkflowJobSummary> = {},
): WorkflowJobSummary => ({
  id: 1,
  name,
  workflowPath,
  status: 'completed',
  conclusion: 'success',
  ...over,
});

const expected = (over: Partial<ExpectedChecks> = {}): ExpectedChecks => ({
  names: [],
  workflows: [],
  unresolved: [],
  ...over,
});

test('every predicted run and check present and green', () => {
  const result = compareObserved(
    [run('a.yml'), run('b.yml')],
    [job('a.yml', 'Build'), job('b.yml', 'Lint')],
    expected({ workflows: ['a.yml', 'b.yml'], names: ['Build', 'Lint'] }),
  );
  expect(result).toEqual({
    unexpected: [],
    unexpectedNames: [],
    missing: [],
    missingNames: [],
    matchedNames: ['Build', 'Lint'],
    matched: ['a.yml', 'b.yml'],
    inProgress: [],
    nonPassing: [],
  });
});

test('a predicted workflow with no run yet is missing', () => {
  const result = compareObserved([run('a.yml')], [], expected({ workflows: ['a.yml', 'b.yml'] }));
  expect(result.missing).toEqual(['b.yml']);
});

test('a predicted check name that has not reported is missing by name', () => {
  const result = compareObserved(
    [run('a.yml')],
    [job('a.yml', 'Build')],
    expected({ workflows: ['a.yml'], names: ['Build', 'Test (20)'] }),
  );
  expect(result.missingNames).toEqual(['Test (20)']);
  expect(result.missing).toEqual([]);
});

test('a renamed job shows as both a missing name and an unexpected one', () => {
  // The workflow still runs and still goes green — only the names diverge.
  const result = compareObserved(
    [run('a.yml')],
    [job('a.yml', 'Build (renamed)')],
    expected({ workflows: ['a.yml'], names: ['Build'] }),
  );
  expect(result.missingNames).toEqual(['Build']);
  expect(result.unexpectedNames).toEqual(['a.yml :: Build (renamed)']);
  expect(result.nonPassing).toEqual([]);
});

test('a check name nobody predicted is unexpected, tagged with its workflow', () => {
  const result = compareObserved(
    [run('a.yml')],
    [job('a.yml', 'Build'), job('a.yml', 'Surprise')],
    expected({ workflows: ['a.yml'], names: ['Build'] }),
  );
  expect(result.unexpectedNames).toEqual(['a.yml :: Surprise']);
});

test('jobs of an unpredicted run are not re-reported as unexpected names', () => {
  const result = compareObserved(
    [run('surprise.yml')],
    [job('surprise.yml', 'Whatever')],
    expected(),
  );
  expect(result.unexpected).toEqual(['surprise.yml']);
  expect(result.unexpectedNames).toEqual([]);
});

test('duplicate unexpected names are reported once, sorted', () => {
  const result = compareObserved(
    [run('a.yml')],
    [job('a.yml', 'Zed'), job('a.yml', 'Alpha'), job('a.yml', 'Zed')],
    expected({ workflows: ['a.yml'] }),
  );
  expect(result.unexpectedNames).toEqual(['a.yml :: Alpha', 'a.yml :: Zed']);
});

test('the same check name across two workflows is satisfied by either', () => {
  const result = compareObserved(
    [run('a.yml'), run('b.yml')],
    [job('a.yml', 'Build')],
    expected({ workflows: ['a.yml', 'b.yml'], names: ['Build'] }),
  );
  expect(result.missingNames).toEqual([]);
  expect(result.unexpectedNames).toEqual([]);
});

test('a non-completed run is in progress', () => {
  const result = compareObserved(
    [run('a.yml', { status: 'in_progress', conclusion: null })],
    [],
    expected({ workflows: ['a.yml'] }),
  );
  expect(result.inProgress).toEqual(['a.yml']);
  expect(result.nonPassing).toEqual([]);
});

test('a completed run with a failing conclusion is non-passing', () => {
  const result = compareObserved(
    [run('a.yml', { conclusion: 'cancelled' })],
    [],
    expected({ workflows: ['a.yml'] }),
  );
  expect(result.nonPassing).toEqual(['a.yml (cancelled)']);
});

test('a startup_failure run has no jobs and is still caught at run granularity', () => {
  const result = compareObserved(
    [run('a.yml', { conclusion: 'startup_failure' })],
    [],
    expected({ workflows: ['a.yml'] }),
  );
  expect(result.nonPassing).toEqual(['a.yml (startup_failure)']);
  expect(result.missingNames).toEqual([]);
});

test('a continue-on-error job does not fail the gate on its own conclusion', () => {
  // The job reports `failure` but the run is green and so is the check.
  const result = compareObserved(
    [run('a.yml')],
    [job('a.yml', 'Flaky', { conclusion: 'failure' })],
    expected({ workflows: ['a.yml'], names: ['Flaky'] }),
  );
  expect(result.nonPassing).toEqual([]);
  expect(result.missingNames).toEqual([]);
});

test('a run for no known workflow is unexpected and not otherwise classified', () => {
  const result = compareObserved([run('surprise.yml', { conclusion: 'failure' })], [], expected());
  expect(result.unexpected).toEqual(['surprise.yml']);
  expect(result.matched).toEqual([]);
  expect(result.nonPassing).toEqual([]);
});

test('duplicate unexpected runs are reported once, sorted', () => {
  const result = compareObserved([run('z.yml'), run('a.yml'), run('z.yml')], [], expected());
  expect(result.unexpected).toEqual(['a.yml', 'z.yml']);
});
