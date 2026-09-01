import type { Octokit } from '../types';
import { isNotFound } from './isNotFound';

/** Where a commit sits relative to a tag; `missing` means the tag does not exist. */
export type TagRelation = 'missing' | 'ahead' | 'behind' | 'identical' | 'diverged';

export interface TagComparison {
  relation: TagRelation;
  /** Commits `sha` sits ahead of the tag by; 0 when the tag does not exist yet. */
  aheadBy: number;
}

// Ancestry, not timestamps: descendancy survives re-runs and out-of-order queueing.
// The tag is named rather than resolved so compare dereferences it — an annotated
// tag's ref points at a tag object, which compare would reject.
export async function compareToTag(
  github: Octokit,
  owner: string,
  repo: string,
  tag: string,
  sha: string,
): Promise<TagComparison> {
  try {
    await github.rest.git.getRef({ owner, repo, ref: `tags/${tag}` });
  } catch (err) {
    if (isNotFound(err)) return { relation: 'missing', aheadBy: 0 };
    throw err;
  }

  const { data } = await github.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${tag}...${sha}`,
  });
  return { relation: data.status, aheadBy: data.ahead_by };
}
