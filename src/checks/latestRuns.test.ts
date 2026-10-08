import { expect, test } from 'vitest';
import { latestRuns } from './latestRuns';
import type { WorkflowRunSummary } from '../types';

function run(id: number, over: Partial<WorkflowRunSummary> = {}): WorkflowRunSummary {
  return {
    id,
    name: 'Tests',
    path: 'a.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    ...over,
  };
}

test('the newest run of a workflow supersedes older ones, in either order', () => {
  const old = run(1, { conclusion: 'failure' });
  const fresh = run(2);
  expect(latestRuns([old, fresh])).toEqual([fresh]);
  expect(latestRuns([fresh, old])).toEqual([fresh]);
});

test('a cancelled run never supersedes one that was not cancelled', () => {
  const done = run(1);
  expect(latestRuns([done, run(2, { conclusion: 'cancelled' })])).toEqual([done]);
  expect(latestRuns([run(2, { conclusion: 'cancelled' }), done])).toEqual([done]);
});

test('a still-running newer run supersedes an older verdict', () => {
  const going = run(2, { status: 'in_progress', conclusion: null });
  expect(latestRuns([run(1, { conclusion: 'failure' }), going])).toEqual([going]);
});

test('with every sibling cancelled, the newest stands', () => {
  const newest = run(2, { conclusion: 'cancelled' });
  expect(latestRuns([run(1, { conclusion: 'cancelled' }), newest])).toEqual([newest]);
  expect(latestRuns([newest, run(1, { conclusion: 'cancelled' })])).toEqual([newest]);
});

test('different workflows and events are kept apart', () => {
  const runs = [run(1), run(2, { path: 'b.yml' }), run(3, { event: 'pull_request_target' })];
  expect(latestRuns(runs)).toEqual(runs);
});

test('a duplicate listing of the same run does not replace the one already held', () => {
  const first = run(1, { conclusion: 'failure' });
  expect(latestRuns([first, run(1)])).toEqual([first]);
});
