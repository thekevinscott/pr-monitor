/**
 * willfire can see a job but cannot say what checks it will create — a matrix
 * built from another job's output is the case that actually occurs.
 *
 * The gate's contract is that the observed check set equals the predicted one.
 * An entry with no name leaves the predicted set incomplete, so the contract
 * cannot be honoured: a missing name would be indistinguishable from a leg that
 * was never predicted, and an extra one from a leg that was. Nothing observed
 * later settles that, so the gate fails now, naming the entries, rather than
 * carving out an exemption that would hide real divergence in the same workflow.
 */
export function formatUnresolvedFailure(unresolved: string[]): string {
  return [
    `Unresolvable check names: ${JSON.stringify(unresolved)}.`,
    'willfire sees these jobs but cannot say what checks they will create, so',
    'the predicted set is incomplete and the gate cannot compare against it.',
    'Either give the job a statically expandable matrix, or grant execution of',
    "the job that computes it via the action's `execute` input.",
  ].join(' ');
}
