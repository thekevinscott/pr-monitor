import { afterEach, expect, test } from 'vitest';
import { envList } from './envList';

afterEach(() => {
  delete process.env.X_LIST_TEST;
});

test('undefined → []', () => {
  expect(envList('X_LIST_TEST')).toEqual([]);
});

test('empty string → []', () => {
  process.env.X_LIST_TEST = '';
  expect(envList('X_LIST_TEST')).toEqual([]);
});

test('single value', () => {
  process.env.X_LIST_TEST = 'foo';
  expect(envList('X_LIST_TEST')).toEqual(['foo']);
});

test('comma-separated', () => {
  process.env.X_LIST_TEST = 'a,b,c';
  expect(envList('X_LIST_TEST')).toEqual(['a', 'b', 'c']);
});

test('trims whitespace and drops empty entries', () => {
  process.env.X_LIST_TEST = ' a , , b ,';
  expect(envList('X_LIST_TEST')).toEqual(['a', 'b']);
});
