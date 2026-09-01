import { isGrant } from './isGrant';

export interface ExecuteInput {
  execute: boolean;
  /** The retired `owner/repo:job1,job2` spelling, verbatim, for the caller to warn about. */
  legacy: string | null;
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
