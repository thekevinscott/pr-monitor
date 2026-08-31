import type { Octokit } from '../types';
import { isNotFound } from './isNotFound';

/** Where a commit sits relative to a tag; `missing` means the tag does not exist. */
export type TagRelation = 'missing' | 'ahead' | 'behind' | 'identical' | 'diverged';

/**
 * Ancestry, not timestamps: whether the commit is a descendant of the tag holds
 * under re-runs, retries, and out-of-order queueing, which wall-clock order does
 * not.
 *
 * The tag is named rather than resolved to a SHA so the compare endpoint does the
 * dereferencing — an annotated tag's ref points at a tag object, which `compare`
 * would reject.
 */
export async function compareToTag(
  github: Octokit,
  owner: string,
  repo: string,
  tag: string,
  sha: string,
): Promise<TagRelation> {
  try {
    await github.rest.git.getRef({ owner, repo, ref: `tags/${tag}` });
  } catch (err) {
    if (isNotFound(err)) return 'missing';
    throw err;
  }

  const { data } = await github.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${tag}...${sha}`,
  });
  return data.status;
}
