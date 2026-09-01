export function formatUnexpectedFailure(runs: string[], names: string[]): string {
  const parts: string[] = [];
  if (runs.length > 0) parts.push(`Unpredicted workflow runs: ${JSON.stringify(runs)}.`);
  if (names.length > 0) parts.push(`Unpredicted check names: ${JSON.stringify(names)}.`);
  parts.push(
    'These reported but willfire did not predict them, so the gate cannot',
    'confirm the check set is complete. Likely a renamed job, a matrix that',
    'grew a combination, a workflow trigger willfire does not model',
    '(workflow_run, pull_request_target), or a prediction bug.',
  );
  return parts.join(' ');
}
