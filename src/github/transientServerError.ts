export interface TransientServerError {
  status: number;
  endpoint: string;
}

/** Octokit supplies request.url; willfire's fetch client puts the path in its error message. */
export function transientServerError(err: unknown): TransientServerError | null {
  const error = err as {
    status?: unknown;
    message?: string;
    request?: { url?: string };
    response?: { url?: string };
  } | null;
  const status = error?.status;
  if (status !== 500 && status !== 502 && status !== 503 && status !== 504) return null;
  const endpoint = error?.request?.url ?? error?.response?.url ??
    /^GitHub API \d+ for (.+)$/.exec(error?.message ?? '')?.[1] ?? 'unknown endpoint';
  return { status, endpoint };
}
