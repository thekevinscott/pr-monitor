import * as core from '@actions/core';
import { run } from './run';

export function reportFailure(err: unknown): void {
  core.setFailed(err instanceof Error ? err.message : String(err));
}

run().catch(reportFailure);
