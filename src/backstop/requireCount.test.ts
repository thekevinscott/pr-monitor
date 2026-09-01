import { expect, test } from 'vitest';
import { requireCount } from './requireCount';

test('parses a count within the bound', () => {
  expect(requireCount('BACKSTOP_DEPTH', '20', 100)).toBe(20);
});

test('an unset value fails naming the variable', () => {
  expect(() => requireCount('BACKSTOP_DEPTH', undefined, 100)).toThrow('BACKSTOP_DEPTH is required');
});

test('a non-numeric value fails rather than reading as zero', () => {
  expect(() => requireCount('BACKSTOP_DEPTH', 'twenty', 100)).toThrow(
    'BACKSTOP_DEPTH must be an integer between 1 and 100',
  );
});

test('a fractional value fails', () => {
  expect(() => requireCount('BACKSTOP_DEPTH', '2.5', 100)).toThrow('between 1 and 100');
});

test('zero fails, since a walk of nothing can only report nothing', () => {
  expect(() => requireCount('BACKSTOP_DEPTH', '0', 100)).toThrow('between 1 and 100');
});

test('a value past the bound fails rather than being silently truncated', () => {
  expect(() => requireCount('BACKSTOP_DEPTH', '101', 100)).toThrow('between 1 and 100');
});

test('the bound itself is allowed', () => {
  expect(requireCount('BACKSTOP_DEPTH', '100', 100)).toBe(100);
});
