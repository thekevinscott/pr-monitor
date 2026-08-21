import type { PredictOptions } from 'willfire';

/** willfire's execution grant, named via the option that carries it. */
export type ExecutionGrant = NonNullable<PredictOptions['execute']>[number];

/**
 * Parse the action's `execute` input into willfire execution grants.
 *
 * Whitespace-separated entries, each `owner/repo:job1,job2` with no internal
 * whitespace — the spelling of willfire's own `--execute` flag, where
 * `owner/repo` is the repo the workflow *file* lives in. An empty input
 * grants nothing.
 *
 * A grant is permission to run code, so a malformed entry is refused rather
 * than skipped: dropping it silently would leave the matrix unresolved and the
 * gate red with a message about dynamic matrices, pointing away from the typo
 * that caused it. The offending entry comes back for the caller to name.
 */
export function parseGrants(
  raw: string,
): { grants: ExecutionGrant[] } | { malformed: string } {
  const grants: ExecutionGrant[] = [];
  for (const spec of raw.split(/\s+/).filter((s) => s !== '')) {
    const colon = spec.indexOf(':');
    const repo = spec.slice(0, colon);
    const jobs = spec
      .slice(colon + 1)
      .split(',')
      .filter((s) => s !== '');
    const repoParts = repo.split('/');
    const wellFormed =
      colon > 0 && repoParts.length === 2 && repoParts.every((p) => p !== '') && jobs.length > 0;
    if (!wellFormed) return { malformed: spec };
    grants.push({ repo, jobs });
  }
  return { grants };
}
