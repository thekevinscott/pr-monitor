import { expect, test } from 'vitest';
import { isNotFound } from './isNotFound';

test('a 404 error object is a not-found', () => {
  expect(isNotFound(Object.assign(new Error('Not Found'), { status: 404 }))).toBe(true);
});

test('another status is not a not-found', () => {
  expect(isNotFound(Object.assign(new Error('rate limited'), { status: 403 }))).toBe(false);
});

test('an error with no status is not a not-found', () => {
  expect(isNotFound(new Error('socket hang up'))).toBe(false);
});

test('null and non-objects are not a not-found', () => {
  expect(isNotFound(null)).toBe(false);
  expect(isNotFound('404')).toBe(false);
});
