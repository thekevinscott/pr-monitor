export function formatMissingNames(names: string[]): string {
  return (
    `Predicted check names that never reported: ${JSON.stringify(names)}. ` +
    'Every predicted run finished, so these are not late — willfire and the ' +
    'checks GitHub created disagree. Likely a renamed or deleted job, or a ' +
    'matrix that stopped expanding to a combination.'
  );
}
