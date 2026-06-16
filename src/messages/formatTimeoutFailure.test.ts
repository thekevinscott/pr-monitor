import { expect, test } from 'vitest';
import { formatTimeoutFailure } from './formatTimeoutFailure';

test('needsMore → mentions required check count', () => {
  expect(
    formatTimeoutFailure({
      maxDurationMs: 60_000,
      needsMore: true,
      relevantCount: 0,
      minimumChecks: 1,
      inProgress: [],
    }),
  ).toBe('Timeout after 1 minutes. Only 0/1 required workflow runs appeared.');
});

test('!needsMore → mentions in-progress list', () => {
  expect(
    formatTimeoutFailure({
      maxDurationMs: 120_000,
      needsMore: false,
      relevantCount: 1,
      minimumChecks: 1,
      inProgress: ['Test'],
    }),
  ).toBe('Timeout after 2 minutes. Still in progress: ["Test"]');
});
