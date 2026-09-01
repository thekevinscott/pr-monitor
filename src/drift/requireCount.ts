import { requireEnv } from '../promote/requireEnv';

// Parsed rather than coerced: a NaN limit compares false forever, so the alarm
// would pass in silence — the failure mode it exists to catch.
export function requireCount(name: string, value: string | undefined): number {
  const count = Number(requireEnv(name, value));

  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return count;
}
