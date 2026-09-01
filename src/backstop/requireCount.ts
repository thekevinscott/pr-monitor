import { requireEnv } from '../promote/requireEnv';

// Bounded because it sizes a single REST page: an oversized depth would quietly
// read fewer commits than it asked for.
export function requireCount(name: string, value: string | undefined, max: number): number {
  const count = Number(requireEnv(name, value));

  if (!Number.isInteger(count) || count < 1 || count > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }

  return count;
}
