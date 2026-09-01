import { expect, test } from 'vitest';
import { readSurface } from './readSurface';
import type { WorkflowJobSummary } from '../types';

const SELF = '.github/workflows/move-major-tag.yml';

function job(overrides: Partial<WorkflowJobSummary> = {}): WorkflowJobSummary {
  return {
    id: 1,
    name: 'Test (100% coverage)',
    workflowPath: '.github/workflows/test.yml',
    status: 'completed',
    conclusion: 'success',
    ...overrides,
  };
}

test('a passing job list with a known self path reads green', () => {
  expect(readSurface({ selfWorkflowPath: SELF, jobs: [job()] })).toEqual({
    state: 'green',
    names: [],
  });
});

test('an unknown self path is unreadable rather than green', () => {
  expect(readSurface({ selfWorkflowPath: null, jobs: [job()] })).toEqual({
    state: 'unreadable',
    names: [],
  });
});

test("the caller's own jobs are excluded, leaving an empty surface", () => {
  expect(readSurface({ selfWorkflowPath: SELF, jobs: [job({ workflowPath: SELF })] })).toEqual({
    state: 'empty',
    names: [],
  });
});

test('no jobs at all is empty', () => {
  expect(readSurface({ selfWorkflowPath: SELF, jobs: [] }).state).toBe('empty');
});

test('an unfinished job names what is still running', () => {
  expect(
    readSurface({
      selfWorkflowPath: SELF,
      jobs: [job(), job({ name: 'Lint', status: 'in_progress', conclusion: null })],
    }),
  ).toEqual({ state: 'running', names: ['Lint'] });
});

test('running wins over failing, so a red job mid-flight does not settle the answer', () => {
  expect(
    readSurface({
      selfWorkflowPath: SELF,
      jobs: [job({ name: 'Lint', conclusion: 'failure' }), job({ name: 'Typecheck', status: 'queued' })],
    }).state,
  ).toBe('running');
});

test('a completed non-passing job names the failure', () => {
  expect(
    readSurface({ selfWorkflowPath: SELF, jobs: [job({ name: 'Lint', conclusion: 'failure' })] }),
  ).toEqual({ state: 'failing', names: ['Lint'] });
});

test('neutral and stale count as passing', () => {
  expect(
    readSurface({
      selfWorkflowPath: SELF,
      jobs: [job({ conclusion: 'neutral' }), job({ conclusion: 'stale' })],
    }).state,
  ).toBe('green');
});
