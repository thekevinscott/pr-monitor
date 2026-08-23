import type { GateComparison } from '../types';
import { formatMissingNames, formatUnexpectedFailure } from '../messages';

/**
 * Say how the observed check set differs from the predicted one, or null when
 * it does not.
 *
 * Divergence is set membership only. A run that failed is a real failure, not a
 * disagreement about the set, so it is not reported here — and it suppresses
 * the missing-name verdict, because once a job fails the ones downstream of it
 * never report and naming them would bury the cause.
 *
 * A predicted name that has not reported is only divergence once every
 * predicted run has finished. Before that it is early, not missing.
 */
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
