/**
 * A consumer's grant to execute jobs in one repo.
 *
 * willfire 0.1.31 removed per-repo grants: execution runs in a docker sandbox
 * and the only lever it exposes is the whole executor, on or off. The grant
 * stays pr-monitor's own type because the trust decision is policy and goal 3
 * puts policy outside willfire — but `jobs` is no longer enforced by anything.
 * `monitor` says so in the log rather than letting the narrower spelling imply
 * a limit that is not applied.
 */
export interface ExecutionGrant {
  repo: string;
  jobs: string[];
}

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
