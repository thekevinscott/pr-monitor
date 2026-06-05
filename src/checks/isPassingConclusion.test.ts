import { expect, test } from 'vitest';
import { isPassingConclusion } from './isPassingConclusion';

test.each(['success', 'skipped'] as const)('%s → passing', (c) => {
  expect(isPassingConclusion(c)).toBe(true);
});

test.each(['failure', 'cancelled', 'timed_out', 'neutral', 'action_required', 'stale'] as const)(
  '%s → not passing',
  (c) => {
    expect(isPassingConclusion(c)).toBe(false);
  },
);

test('null → not passing', () => {
  expect(isPassingConclusion(null)).toBe(false);
});
