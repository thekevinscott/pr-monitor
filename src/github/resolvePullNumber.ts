import type { GitHubContextType } from '../types';

/** The PR this run is gating, or null when the event is not a pull request. */
export function resolvePullNumber(context: GitHubContextType): number | null {
  const number = context.payload.pull_request?.number;
  return typeof number === 'number' ? number : null;
}
