export function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (status !== 403 && status !== 429) return false;

  const headers = (err as { response?: { headers?: Record<string, unknown> } }).response
    ?.headers;
  return headers?.['retry-after'] !== undefined || headers?.['x-ratelimit-remaining'] === '0';
}
