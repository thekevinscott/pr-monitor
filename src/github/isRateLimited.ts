export function isRateLimited(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as { status?: unknown }).status;
  if (status !== 403 && status !== 429) return false;

  const response = (err as { response?: unknown }).response;
  const headers =
    typeof response === 'object' && response !== null
      ? (response as { headers?: unknown }).headers
      : undefined;
  if (typeof headers !== 'object' || headers === null) return false;

  const h = headers as Record<string, unknown>;
  return h['retry-after'] !== undefined || h['x-ratelimit-remaining'] === '0';
}
