export function formatUnresolvedFailure(
  unresolved: string[],
  callbacks: readonly string[] = [],
): string {
  const advice =
    callbacks.length > 0
      ? [
          'A resolver is declared, so the thing to debug is the resolver, not the',
          'workflow. Its map keys are `<owner>/<repo>/<workflow-path>:<job-id>`, and',
          'an entry matches on settled inputs only — one conditioned on an input',
          'willfire could not decide never matches, however right it looks.',
        ]
      : [
          'No resolver is declared. For outputs the sandbox cannot compute, set the',
          "action's `resolve-outputs` input to one command per line, each printing a",
          'JSON map keyed by `<owner>/<repo>/<workflow-path>:<job-id>`.',
        ];
  return [
    `Unresolvable check names: ${JSON.stringify(unresolved)}.`,
    'willfire sees these jobs but cannot say what checks they will create, so',
    'the predicted set is incomplete and the gate cannot compare against it.',
    'Execution is always on; there is no input that enables it. Where a sandbox',
    'run or a resolver lookup failed, the entry names the reason.',
    ...advice,
    'Some jobs cannot be settled ahead of time at all, and `unknown` is the right',
    'answer for those.',
  ].join(' ');
}
