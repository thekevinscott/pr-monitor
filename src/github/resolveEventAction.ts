import type { PrEventAction } from 'willfire';
import type { GitHubContextType } from '../types';

/**
 * The `pull_request` action of the event this run is gating, when it is one
 * willfire models. Handing in the truth beats willfire's fallback — inferring
 * `opened` vs `synchronize` from the PR's commit count — which flips dispatch
 * verdicts on workflows that narrow `types:`. Any other action (`labeled`,
 * `ready_for_review`, …) has no honest mapping onto the three, so it returns
 * undefined and leaves willfire to its fallback rather than asserting one.
 */
export function resolveEventAction(context: GitHubContextType): PrEventAction | undefined {
  const action = context.payload.action;
  return action === 'opened' || action === 'synchronize' || action === 'reopened'
    ? action
    : undefined;
}
