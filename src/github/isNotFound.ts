/**
 * A 404 from the REST client, as distinct from every other failure. Narrow on
 * purpose: a missing ref is an answer, a rate limit or a network error is not,
 * and collapsing the two turns an outage into a green light.
 */
export function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { status?: unknown }).status === 404
  );
}
