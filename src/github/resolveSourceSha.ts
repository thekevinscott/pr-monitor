import type { SourceRef } from 'willfire';
import type { PredictClient } from '../types';

/**
 * `getCommit`, not the cheaper `git/ref`: only the same lookup willfire makes inside `predict`
 * is comparable, and swapping it breaks `reconcile` with no test failing.
 */
export async function resolveSourceSha(
  github: PredictClient,
  { owner, repo, ref }: SourceRef,
): Promise<string | null> {
  try {
    const commit = await github.getCommit({ owner, repo, ref });
    return commit.sha;
  } catch {
    return null;
  }
}
