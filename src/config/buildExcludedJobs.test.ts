import { expect, test } from 'vitest';
import { buildExcludedJobs } from './buildExcludedJobs';

test('combines jobName and extras', () => {
  expect(buildExcludedJobs('Gate', ['Deploy', 'Notify'])).toEqual(['Gate', 'Deploy', 'Notify']);
});

test('empty jobName is filtered out', () => {
  expect(buildExcludedJobs('', ['Deploy'])).toEqual(['Deploy']);
});

test('falsy extras are filtered out', () => {
  expect(buildExcludedJobs('Gate', ['', 'Deploy'])).toEqual(['Gate', 'Deploy']);
});

test('empty both → empty list', () => {
  expect(buildExcludedJobs('', [])).toEqual([]);
});
