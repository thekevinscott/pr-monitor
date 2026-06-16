import { expect, test } from 'vitest';
import { isPassingConclusion } from './isPassingConclusion';

test.each(['success', 'skipped', 'neutral', 'stale'] as const)('%s → passing', (c) => {
  expect(isPassingConclusion(c)).toBe(true);
});

test.each(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure'] as const)(
  '%s → not passing',
  (c) => {
    expect(isPassingConclusion(c)).toBe(false);
  },
);

test('null → not passing', () => {
  expect(isPassingConclusion(null)).toBe(false);
});
