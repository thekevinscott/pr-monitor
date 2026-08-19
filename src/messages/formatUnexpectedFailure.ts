/**
 * A run GitHub created that willfire did not predict means the two disagree about
 * the check set, so the gate cannot vouch for it. Name the runs and the likely
 * causes rather than waiting them out.
 */
export function formatUnexpectedFailure(unexpected: string[]): string {
  return [
    `Unpredicted workflow runs: ${JSON.stringify(unexpected)}.`,
    'These dispatched but willfire did not predict them, so the gate cannot',
    'confirm the check set is complete. Likely a workflow trigger willfire does',
    'not model (workflow_run, pull_request_target) or a prediction bug.',
  ].join(' ');
}
