import { expect, test } from 'vitest';
import { resolveSelfWorkflowPath } from './resolveSelfWorkflowPath';

test('extracts the workflow path from a pull-request ref', () => {
  expect(resolveSelfWorkflowPath('o/r/.github/workflows/gate.yml@refs/pull/5/merge')).toBe(
    '.github/workflows/gate.yml',
  );
});

test('extracts the workflow path from a branch ref', () => {
  expect(resolveSelfWorkflowPath('o/r/.github/workflows/gate.yml@refs/heads/main')).toBe(
    '.github/workflows/gate.yml',
  );
});

test('unset → null', () => {
  expect(resolveSelfWorkflowPath(undefined)).toBeNull();
});

test('malformed (no @ref) → null', () => {
  expect(resolveSelfWorkflowPath('o/r/.github/workflows/gate.yml')).toBeNull();
});
