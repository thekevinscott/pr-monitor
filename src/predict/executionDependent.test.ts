import { expect, test } from 'vitest';
import type { Entry, JobEntry, Prediction } from 'willfire';
import { executionDependent } from './executionDependent';

const prediction = (...entries: Entry[]): Prediction => ({
  entries,
  checkNames: [],
  skip: null,
  sources: [],
});

const jobEntry = (
  workflow: string,
  job: string,
  checkName: string | null,
  status: JobEntry['status'] = 'run',
  reason = 'because',
): JobEntry => ({ workflow, job: job as JobEntry['job'], checkName, status, reason });

test('a workflow whose matrix only execution resolves depends on it', () => {
  expect(
    executionDependent(
      prediction(jobEntry('a.yml', 'plan', 'plan'), jobEntry('a.yml', 'build (1)', 'build (1)')),
      prediction(jobEntry('a.yml', 'plan', 'plan'), jobEntry('a.yml', 'build', null, 'unknown')),
    ),
  ).toEqual(['a.yml']);
});

test('identical entries in another order, with other reasons, depend on nothing', () => {
  expect(
    executionDependent(
      prediction(jobEntry('a.yml', 'x', 'X'), jobEntry('a.yml', 'y', 'Y', 'run', 'one')),
      prediction(jobEntry('a.yml', 'y', 'Y', 'run', 'two'), jobEntry('a.yml', 'x', 'X')),
    ),
  ).toEqual([]);
});

test('a status that only execution settles is a dependence', () => {
  expect(
    executionDependent(
      prediction(jobEntry('a.yml', 'x', 'X', 'skipped')),
      prediction(jobEntry('a.yml', 'x', 'X', 'unknown')),
    ),
  ).toEqual(['a.yml']);
});

test('a repeated entry counts, and a workflow on one side only differs', () => {
  expect(
    executionDependent(
      prediction(jobEntry('c.yml', 'x', 'X'), jobEntry('c.yml', 'x', 'X'), jobEntry('a.yml', 'x', 'X')),
      prediction(jobEntry('c.yml', 'x', 'X'), jobEntry('b.yml', 'x', 'X'), jobEntry('a.yml', 'x', 'X')),
    ),
  ).toEqual(['b.yml', 'c.yml']);
});
