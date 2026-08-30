/**
 * Predicted names that never reported, once everything that could still report
 * has finished. Divergence, not lateness — so it is stated as disagreement
 * between willfire and GitHub rather than as a timeout.
 */
export function formatMissingNames(names: string[]): string {
  return (
    `Predicted check names that never reported: ${JSON.stringify(names)}. ` +
    'Every predicted run finished, so these are not late — willfire and the ' +
    'checks GitHub created disagree. Likely a renamed or deleted job, or a ' +
    'matrix that stopped expanding to a combination.'
  );
}
