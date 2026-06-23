import * as core from '@actions/core';
import { run } from './run';

// Surfaces a rejected run() as an Action failure. Exported so the message/branch
// is unit-tested in entry.test.ts; the call below wires it to the tsx runtime.
export function reportFailure(err: unknown): void {
  core.setFailed(err instanceof Error ? err.message : String(err));
}

run().catch(reportFailure);
