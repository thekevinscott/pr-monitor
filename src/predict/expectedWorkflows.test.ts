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
  expect(result).toEqual({ required: ['a.yml'], tolerated: [] });
});

test('a job-level unknown still requires the workflow run', () => {
  // The run exists whatever the dynamic matrix expands to.
  const result = expectedWorkflows(prediction(entry('a.yml', 'matrix', 'unknown')), SELF);
  expect(result).toEqual({ required: ['a.yml'], tolerated: [] });
});

test('no-dispatch is neither required nor tolerated', () => {
  const result = expectedWorkflows(prediction(entry('a.yml', '*', 'no-dispatch')), SELF);
  expect(result).toEqual({ required: [], tolerated: [] });
});

test('a workflow-level unknown is tolerated, not required', () => {
  const result = expectedWorkflows(prediction(entry('a.yml', '*', 'unknown')), SELF);
  expect(result).toEqual({ required: [], tolerated: ['a.yml'] });
});

test('a workflow both required and tolerated stays required only', () => {
  const result = expectedWorkflows(
    prediction(entry('a.yml', '*', 'unknown'), entry('a.yml', 'one', 'run')),
    SELF,
  );
  expect(result).toEqual({ required: ['a.yml'], tolerated: [] });
});

test("the gate's own workflow is dropped from both sets", () => {
  const result = expectedWorkflows(
    prediction(entry(SELF, 'monitor', 'run'), entry('a.yml', 'one', 'run')),
    SELF,
  );
  expect(result).toEqual({ required: ['a.yml'], tolerated: [] });
});

test('output is sorted for stable logs', () => {
  const result = expectedWorkflows(
    prediction(entry('c.yml', 'x', 'run'), entry('a.yml', 'x', 'run'), entry('b.yml', '*', 'unknown')),
    SELF,
  );
  expect(result).toEqual({ required: ['a.yml', 'c.yml'], tolerated: ['b.yml'] });
});

test('an empty prediction ([skip ci]) expects nothing', () => {
  expect(expectedWorkflows({ entries: [], skip: 'skip instruction' }, SELF)).toEqual({
    required: [],
    tolerated: [],
  });
});
