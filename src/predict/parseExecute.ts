import { isGrant } from './isGrant';

export interface ExecuteInput {
  execute: boolean;
  legacy: string | null;
}

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
