import { expect, test } from 'vitest';
import { classifyCheckRuns } from './classifyCheckRuns';

test('excluded names are skipped entirely', () => {
  const result = classifyCheckRuns(
    [
      { name: 'Gate', status: 'in_progress', conclusion: null },
      { name: 'Test', status: 'completed', conclusion: 'success' },
    ],
    ['Gate'],
  );
  expect(result).toEqual({ inProgress: [], nonPassing: [], relevantCount: 1 });
});

test('in_progress status → inProgress bucket', () => {
  const result = classifyCheckRuns(
    [{ name: 'Test', status: 'in_progress', conclusion: null }],
    [],
  );
  expect(result.inProgress).toEqual(['Test']);
  expect(result.nonPassing).toEqual([]);
});

test('completed with passing conclusion → not flagged', () => {
  const result = classifyCheckRuns(
    [{ name: 'Test', status: 'completed', conclusion: 'success' }],
    [],
  );
  expect(result.inProgress).toEqual([]);
  expect(result.nonPassing).toEqual([]);
  expect(result.relevantCount).toBe(1);
});

test('completed with non-passing conclusion → nonPassing with conclusion in label', () => {
  const result = classifyCheckRuns(
    [{ name: 'Test', status: 'completed', conclusion: 'cancelled' }],
    [],
  );
  expect(result.nonPassing).toEqual(['Test (cancelled)']);
});

test('mixed checks reported correctly', () => {
  const result = classifyCheckRuns(
    [
      { name: 'A', status: 'completed', conclusion: 'success' },
      { name: 'B', status: 'in_progress', conclusion: null },
      { name: 'C', status: 'completed', conclusion: 'failure' },
      { name: 'D', status: 'completed', conclusion: 'skipped' },
    ],
    [],
  );
  expect(result).toEqual({
    inProgress: ['B'],
    nonPassing: ['C (failure)'],
    relevantCount: 4,
  });
});
