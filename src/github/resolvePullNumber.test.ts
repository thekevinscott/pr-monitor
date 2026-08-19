import { expect, test } from 'vitest';
import { resolvePullNumber } from './resolvePullNumber';
import type { GitHubContextType } from '../types';

const context = (payload: Record<string, unknown>) =>
  ({ payload }) as unknown as GitHubContextType;

test('pull_request payload → its number', () => {
  expect(resolvePullNumber(context({ pull_request: { number: 42 } }))).toBe(42);
});

test('no pull_request payload → null', () => {
  expect(resolvePullNumber(context({}))).toBeNull();
});

test('pull_request without a numeric number → null', () => {
  expect(resolvePullNumber(context({ pull_request: { number: 'nope' } }))).toBeNull();
});
