import type { GateComparison } from '../types';

export function formatProgressLog(comparison: GateComparison): string {
  const parts: string[] = [];
  if (comparison.missing.length > 0) {
    parts.push(`not started: ${JSON.stringify(comparison.missing)}`);
  }
  if (comparison.inProgress.length > 0) {
    parts.push(`in progress: ${JSON.stringify(comparison.inProgress)}`);
  }
  if (comparison.missingNames.length > 0) {
    parts.push(`checks not reported: ${JSON.stringify(comparison.missingNames)}`);
  }
  return parts.join(' | ');
}
