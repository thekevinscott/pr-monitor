import type { GitHubContextType } from '../types';

export function resolvePullNumber(context: GitHubContextType): number | null {
  const number = context.payload.pull_request?.number;
  return typeof number === 'number' ? number : null;
}
