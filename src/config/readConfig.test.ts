import { afterEach, expect, test } from 'vitest';
import { readConfig } from './readConfig';

const KEYS = ['PRE_SLEEP', 'CHECK_INTERVAL', 'TIMEOUT', 'MINIMUM_CHECKS', 'JOB_NAME', 'EXCLUDED_JOBS'] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

test('all defaults when env is unset', () => {
  expect(readConfig()).toEqual({
    preSleepMs: 0,
    checkIntervalMs: 0,
    maxDurationMs: 0,
    minimumChecks: 0,
    excludedJobs: [],
  });
});

test('parses all env vars', () => {
  process.env.PRE_SLEEP = '10';
  process.env.CHECK_INTERVAL = '5';
  process.env.TIMEOUT = '15';
  process.env.MINIMUM_CHECKS = '2';
  process.env.JOB_NAME = 'Gate';
  process.env.EXCLUDED_JOBS = 'Deploy,Notify';
  expect(readConfig()).toEqual({
    preSleepMs: 10_000,
    checkIntervalMs: 5_000,
    maxDurationMs: 15 * 60 * 1000,
    minimumChecks: 2,
    excludedJobs: ['Gate', 'Deploy', 'Notify'],
  });
});
