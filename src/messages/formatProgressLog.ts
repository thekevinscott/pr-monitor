import type { GateComparison } from '../types';

/** One line per poll, naming what the gate is still waiting on. */
export function formatProgressLog(comparison: GateComparison): string {
  const parts: string[] = [];
  if (comparison.missing.length > 0) {
    parts.push(`not started: ${JSON.stringify(comparison.missing)}`);
  }
  if (comparison.inProgress.length > 0) {
    parts.push(`in progress: ${JSON.stringify(comparison.inProgress)}`);
  }
  // Names cannot be waited on directly — a check has no existence before its run
  // creates the job — but showing them says what the gate is actually holding out
  // for, and turns a stall into a readable one.
  if (comparison.missingNames.length > 0) {
    parts.push(`checks not reported: ${JSON.stringify(comparison.missingNames)}`);
  }
  return parts.join(' | ');
}
