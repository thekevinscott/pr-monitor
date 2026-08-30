import type { SourceRef } from 'willfire';
import type { PredictClient } from '../types';

/**
 * Resolve a tag, branch, or SHA to the commit it names, or null when it cannot
 * be resolved.
 *
 * Deliberately the same lookup willfire makes inside `predict`. The point of
 * asking again is to compare the answer against the one a prediction was built
 * on, and two different lookups would not be comparable.
 *
 * Null covers every failure — deleted tag, private repo, rate limit, network —
 * because what an unnameable commit means is the caller's decision, not this
 * function's. It is never a cue to fall back to the ref.
 */
export async function resolveSourceSha(
  github: PredictClient,
  { owner, repo, ref }: SourceRef,
): Promise<string | null> {
  try {
    const { data } = await github.rest.repos.getCommit({ owner, repo, ref });
    return data.sha;
  } catch {
    return null;
  }
}
