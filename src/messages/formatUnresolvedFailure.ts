export function formatUnresolvedFailure(unresolved: string[]): string {
  return [
    `Unresolvable check names: ${JSON.stringify(unresolved)}.`,
    'willfire sees these jobs but cannot say what checks they will create, so',
    'the predicted set is incomplete and the gate cannot compare against it.',
    'Either give the job a statically expandable matrix, or grant execution of',
    "the job that computes it via the action's `execute` input.",
  ].join(' ');
}
