import type { RunComparison } from '../types';

/** One line per poll, naming what the gate is still waiting on. */
export function formatProgressLog(comparison: RunComparison): string {
  const parts: string[] = [];
  if (comparison.missing.length > 0) {
    parts.push(`not started: ${JSON.stringify(comparison.missing)}`);
  }
  if (comparison.inProgress.length > 0) {
    parts.push(`in progress: ${JSON.stringify(comparison.inProgress)}`);
  }
  return parts.join(' | ');
}
