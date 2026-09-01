import type { SourceRef } from 'willfire';
import type { PredictClient } from '../types';

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
