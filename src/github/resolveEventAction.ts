import type { PrEventAction } from 'willfire';
import type { GitHubContextType } from '../types';

/**
 * Beats willfire's fallback, which infers `opened` vs `synchronize` from the PR's
 * commit count and so flips dispatch on workflows that narrow `types:`.
 */
export function resolveEventAction(context: GitHubContextType): PrEventAction | undefined {
  const action = context.payload.action;
  return action === 'opened' || action === 'synchronize' || action === 'reopened'
    ? action
    : undefined;
}
