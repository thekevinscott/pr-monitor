import { expect, test } from 'vitest';
import { formatProgressLog } from './formatProgressLog';

test('waiting for runs only', () => {
  expect(
    formatProgressLog({ inProgress: [], relevantCount: 0, minimumChecks: 1, durationSec: 3 }),
  ).toBe('waiting for runs: 0/1 | elapsed: 3s');
});

test('in progress only', () => {
  expect(
    formatProgressLog({ inProgress: ['A'], relevantCount: 1, minimumChecks: 1, durationSec: 7 }),
  ).toBe('in progress: ["A"] | elapsed: 7s');
});

test('both waiting and in progress', () => {
  expect(
    formatProgressLog({ inProgress: ['A'], relevantCount: 1, minimumChecks: 3, durationSec: 12 }),
  ).toBe('waiting for runs: 1/3 | in progress: ["A"] | elapsed: 12s');
});
