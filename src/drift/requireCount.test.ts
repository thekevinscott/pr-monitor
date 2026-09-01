import { expect, test } from 'vitest';
import { requireCount } from './requireCount';

test('parses a count', () => {
  expect(requireCount('DRIFT_LIMIT', '3')).toBe(3);
});

test('one is the tightest usable limit', () => {
  expect(requireCount('DRIFT_LIMIT', '1')).toBe(1);
});

test('an unset value fails naming the variable', () => {
  expect(() => requireCount('DRIFT_LIMIT', undefined)).toThrow('DRIFT_LIMIT is required');
});

test('a non-numeric value fails rather than comparing against NaN', () => {
  expect(() => requireCount('DRIFT_LIMIT', 'three')).toThrow(
    'DRIFT_LIMIT must be a positive integer',
  );
});

test('a fractional value fails', () => {
  expect(() => requireCount('DRIFT_LIMIT', '1.5')).toThrow('must be a positive integer');
});

test('zero fails, since it would alarm on every commit', () => {
  expect(() => requireCount('DRIFT_LIMIT', '0')).toThrow('must be a positive integer');
});
