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
    const { data } = await github.rest.repos.getCommit({ owner, repo, ref });
    return data.sha;
  } catch {
    return null;
  }
}
