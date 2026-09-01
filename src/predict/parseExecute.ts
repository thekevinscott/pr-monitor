export interface ExecuteInput {
  execute: boolean;
  /** The retired `owner/repo:job1,job2` spelling, verbatim, for the caller to warn about. */
  legacy: string | null;
}

function isGrant(spec: string): boolean {
  const colon = spec.indexOf(':');
  if (colon < 1) return false;
  const repo = spec.slice(0, colon).split('/');
  const jobs = spec.slice(colon + 1).split(',').filter((s) => s !== '');
  return repo.length === 2 && repo.every((half) => half !== '') && jobs.length > 0;
}

/**
 * Read the action's `execute` input, accepting the retired grant spelling as `true`.
 *
 * Permission to run code is never dropped silently, so an unrecognized value is
 * refused rather than defaulted, and comes back for the caller to name.
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
