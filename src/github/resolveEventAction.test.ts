import { expect, test } from 'vitest';
import type { GitHubContextType } from '../types';
import { resolveEventAction } from './resolveEventAction';

const context = (payload: Record<string, unknown>) =>
  ({ payload }) as unknown as GitHubContextType;

test.each(['opened', 'synchronize', 'reopened'] as const)('%s passes through', (action) => {
  expect(resolveEventAction(context({ action }))).toBe(action);
});

test('an action willfire does not model → undefined', () => {
  expect(resolveEventAction(context({ action: 'labeled' }))).toBeUndefined();
});

test('no action on the payload → undefined', () => {
  expect(resolveEventAction(context({}))).toBeUndefined();
});
