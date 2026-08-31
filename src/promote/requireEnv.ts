/**
 * An environment value the gate cannot run without. Throwing beats defaulting:
 * a blank tag or SHA would otherwise reach the API as a plausible-looking
 * request and the failure would surface far from its cause.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
