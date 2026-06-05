import { afterEach, expect, test } from 'vitest';
import { envInt } from './envInt';

afterEach(() => {
  delete process.env.X_INT_TEST;
});

test('undefined env → default', () => {
  expect(envInt('X_INT_TEST', 42)).toBe(42);
});

test('empty env → default', () => {
  process.env.X_INT_TEST = '';
  expect(envInt('X_INT_TEST', 42)).toBe(42);
});

test('non-numeric env → default', () => {
  process.env.X_INT_TEST = 'abc';
  expect(envInt('X_INT_TEST', 42)).toBe(42);
});

test('numeric env → parsed value', () => {
  process.env.X_INT_TEST = '7';
  expect(envInt('X_INT_TEST', 42)).toBe(7);
});

test('zero is a valid value (not the default)', () => {
  process.env.X_INT_TEST = '0';
  expect(envInt('X_INT_TEST', 42)).toBe(0);
});
