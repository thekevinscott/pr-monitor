import type { Config } from '../types';
import { envInt, envList } from '../env';
import { buildExcludedJobs } from './buildExcludedJobs';

export function readConfig(): Config {
  return {
    preSleepMs: envInt('PRE_SLEEP', 0) * 1000,
    checkIntervalMs: envInt('CHECK_INTERVAL', 0) * 1000,
    maxDurationMs: envInt('TIMEOUT', 0) * 60 * 1000,
    minimumChecks: envInt('MINIMUM_CHECKS', 0),
    excludedJobs: buildExcludedJobs(process.env.JOB_NAME ?? '', envList('EXCLUDED_JOBS')),
  };
}
