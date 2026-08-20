import { expect, test } from 'vitest';
import type { Entry, Prediction } from 'willfire';
import { expectedWorkflows } from './expectedWorkflows';

const SELF = '.github/workflows/gate.yml';

function prediction(...entries: Entry[]): Prediction {
  return { entries, skip: null };
}

const entry = (workflow: string, job: string, status: Entry['status']): Entry => ({
  workflow,
  job,
  status,
  reason: 'because',
});

test('job entries make their workflow required, once', () => {
  const result = expectedWorkflows(
    prediction(entry('a.yml', 'one', 'run'), entry('a.yml', 'two', 'skipped')),
    SELF,
  );
  expect(result).toEqual({ required: ['a.yml'] });
});

test('a job-level unknown still requires the workflow run', () => {
  // The run exists whatever the dynamic matrix expands to.
  const result = expectedWorkflows(prediction(entry('a.yml', 'matrix', 'unknown')), SELF);
  expect(result).toEqual({ required: ['a.yml'] });
});

test('no-dispatch is not required', () => {
  const result = expectedWorkflows(prediction(entry('a.yml', '*', 'no-dispatch')), SELF);
  expect(result).toEqual({ required: [] });
});

test('a workflow-level verdict that is not no-dispatch is required', () => {
  // willfire reports a startup-failing workflow at `job: "*"`: the run exists
  // but has no jobs to expand. It still has to appear and it still has to pass.
  const result = expectedWorkflows(prediction(entry('a.yml', '*', 'run')), SELF);
  expect(result).toEqual({ required: ['a.yml'] });
});

test("the gate's own workflow is dropped from the expected set", () => {
  const result = expectedWorkflows(
    prediction(entry(SELF, 'monitor', 'run'), entry('a.yml', 'one', 'run')),
    SELF,
  );
  expect(result).toEqual({ required: ['a.yml'] });
});

test('output is sorted for stable logs', () => {
  const result = expectedWorkflows(
    prediction(entry('c.yml', 'x', 'run'), entry('a.yml', 'x', 'run'), entry('b.yml', 'x', 'run')),
    SELF,
  );
  expect(result).toEqual({ required: ['a.yml', 'b.yml', 'c.yml'] });
});

test('an empty prediction ([skip ci]) expects nothing', () => {
  expect(expectedWorkflows({ entries: [], skip: 'skip instruction' }, SELF)).toEqual({
    required: [],
  });
});
