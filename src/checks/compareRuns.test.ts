import { expect, test } from 'vitest';
import { compareRuns } from './compareRuns';
import type { ExpectedWorkflows, WorkflowRunSummary } from '../types';

const run = (path: string, over: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary => ({
  id: 1,
  name: path,
  path,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  ...over,
});

const expected = (over: Partial<ExpectedWorkflows> = {}): ExpectedWorkflows => ({
  required: [],
  ...over,
});

test('every required run present and green', () => {
  const result = compareRuns([run('a.yml'), run('b.yml')], expected({ required: ['a.yml', 'b.yml'] }));
  expect(result).toEqual({
    unexpected: [],
    missing: [],
    matched: ['a.yml', 'b.yml'],
    inProgress: [],
    nonPassing: [],
  });
});

test('a required workflow with no run yet is missing', () => {
  const result = compareRuns([run('a.yml')], expected({ required: ['a.yml', 'b.yml'] }));
  expect(result.missing).toEqual(['b.yml']);
});

test('a non-completed run is in progress', () => {
  const result = compareRuns(
    [run('a.yml', { status: 'in_progress', conclusion: null })],
    expected({ required: ['a.yml'] }),
  );
  expect(result.inProgress).toEqual(['a.yml']);
  expect(result.nonPassing).toEqual([]);
});

test('a completed run with a failing conclusion is non-passing', () => {
  const result = compareRuns([run('a.yml', { conclusion: 'cancelled' })], expected({ required: ['a.yml'] }));
  expect(result.nonPassing).toEqual(['a.yml (cancelled)']);
});

test('a run for no known workflow is unexpected and not otherwise classified', () => {
  const result = compareRuns([run('surprise.yml', { conclusion: 'failure' })], expected());
  expect(result.unexpected).toEqual(['surprise.yml']);
  expect(result.matched).toEqual([]);
  expect(result.nonPassing).toEqual([]);
});

test('duplicate unexpected runs are reported once, sorted', () => {
  const result = compareRuns([run('z.yml'), run('a.yml'), run('z.yml')], expected());
  expect(result.unexpected).toEqual(['a.yml', 'z.yml']);
});
