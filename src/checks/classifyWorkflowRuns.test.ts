import { expect, test } from 'vitest';
import { classifyWorkflowRuns } from './classifyWorkflowRuns';

test('excluded names are skipped entirely', () => {
  const result = classifyWorkflowRuns(
    [
      { id: 1, name: 'Gate', status: 'in_progress', conclusion: null },
      { id: 2, name: 'Test', status: 'completed', conclusion: 'success' },
    ],
    ['Gate'],
  );
  expect(result).toEqual({ inProgress: [], nonPassing: [], relevantCount: 1 });
});

test('non-completed status → inProgress bucket', () => {
  const result = classifyWorkflowRuns(
    [{ id: 1, name: 'Test', status: 'in_progress', conclusion: null }],
    [],
  );
  expect(result.inProgress).toEqual(['Test']);
  expect(result.nonPassing).toEqual([]);
});

test('queued (not yet completed) run waits', () => {
  const result = classifyWorkflowRuns([{ id: 1, name: 'Test', status: 'queued', conclusion: null }], []);
  expect(result.inProgress).toEqual(['Test']);
});

test('completed with passing conclusion → not flagged', () => {
  const result = classifyWorkflowRuns(
    [{ id: 1, name: 'Test', status: 'completed', conclusion: 'success' }],
    [],
  );
  expect(result.inProgress).toEqual([]);
  expect(result.nonPassing).toEqual([]);
  expect(result.relevantCount).toBe(1);
});

test('completed with non-passing conclusion → nonPassing with conclusion in label', () => {
  const result = classifyWorkflowRuns(
    [{ id: 1, name: 'Test', status: 'completed', conclusion: 'cancelled' }],
    [],
  );
  expect(result.nonPassing).toEqual(['Test (cancelled)']);
});

test('mixed runs reported correctly', () => {
  const result = classifyWorkflowRuns(
    [
      { id: 1, name: 'A', status: 'completed', conclusion: 'success' },
      { id: 2, name: 'B', status: 'in_progress', conclusion: null },
      { id: 3, name: 'C', status: 'completed', conclusion: 'failure' },
      { id: 4, name: 'D', status: 'completed', conclusion: 'skipped' },
    ],
    [],
  );
  expect(result).toEqual({
    inProgress: ['B'],
    nonPassing: ['C (failure)'],
    relevantCount: 4,
  });
});
