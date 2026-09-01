/**
 * The `execute` input, read.
 *
 * `legacy` carries the retired `owner/repo:job1,job2` spelling back to the
 * caller so the warning can quote what was written. `null` means the input was
 * spelled as the boolean it is.
 */
export interface ExecuteInput {
  execute: boolean;
  legacy: string | null;
}

/** `owner/repo:job1,job2` — the spelling willfire's `--execute` flag once took. */
function isGrant(spec: string): boolean {
  const colon = spec.indexOf(':');
  if (colon < 1) return false;
  const repo = spec.slice(0, colon).split('/');
  const jobs = spec.slice(colon + 1).split(',').filter((s) => s !== '');
  return repo.length === 2 && repo.every((half) => half !== '') && jobs.length > 0;
}

/**
 * Parse the action's `execute` input into the one switch willfire exposes.
 *
 * willfire 0.1.31 removed per-repo and per-job grants: execution is on or off
 * for the whole prediction, and the executor's workspace is the PR's own repo
 * at the predicted commit. So the input is a boolean, and the older
 * whitespace-separated `owner/repo:job1,job2` spelling is accepted only for
 * compatibility — every well-formed one of those meant `true` already.
 *
 * Permission to run code is never dropped silently: a value that is neither is
 * refused rather than defaulted, and comes back for the caller to name. The
 * alternative is a gate that goes red about an unresolved dynamic matrix,
 * pointing away from the typo that caused it.
 */
export function parseExecute(raw: string): ExecuteInput | { malformed: string } {
  const value = raw.trim();
  if (value === '') return { execute: false, legacy: null };
  const lower = value.toLowerCase();
  if (lower === 'true') return { execute: true, legacy: null };
  if (lower === 'false') return { execute: false, legacy: null };
  for (const spec of value.split(/\s+/)) {
    if (!isGrant(spec)) return { malformed: spec };
  }
  return { execute: true, legacy: value };
}
