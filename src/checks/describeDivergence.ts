import type { GateComparison } from '../types';
import { formatMissingNames } from '../messages/formatMissingNames';
import { formatUnexpectedFailure } from '../messages/formatUnexpectedFailure';

/** A failure suppresses the missing-name verdict: jobs downstream of it never report. */
export function describeDivergence(comparison: GateComparison): string | null {
  if (comparison.unexpected.length > 0 || comparison.unexpectedNames.length > 0) {
    return formatUnexpectedFailure(comparison.unexpected, comparison.unexpectedNames);
  }
  const settled = comparison.missing.length === 0 && comparison.inProgress.length === 0;
  if (settled && comparison.nonPassing.length === 0 && comparison.missingNames.length > 0) {
    return formatMissingNames(comparison.missingNames);
  }
  return null;
}
