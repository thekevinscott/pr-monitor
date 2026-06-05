import { expect, test } from 'vitest';
import { computeRemainingPreSleep } from './computeRemainingPreSleep';

test('full preSleep when actionStartMs is 0 (unset)', () => {
  expect(computeRemainingPreSleep(10_000, 0, 999_999)).toBe(10_000);
});

test('subtracts elapsed setup time', () => {
  expect(computeRemainingPreSleep(10_000, 1_000_000, 1_003_000)).toBe(7_000);
});

test('clamps to 0 when setup took longer than preSleep', () => {
  expect(computeRemainingPreSleep(10_000, 1_000_000, 1_015_000)).toBe(0);
});

test('zero preSleep stays zero', () => {
  expect(computeRemainingPreSleep(0, 1_000_000, 1_005_000)).toBe(0);
});
