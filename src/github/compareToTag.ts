import type { Octokit } from '../types';
import { isNotFound } from './isNotFound';

export type TagRelation = 'missing' | 'ahead' | 'behind' | 'identical' | 'diverged';

/** The tag is named, not resolved: an annotated tag's ref is a tag object, which `compare` rejects. */
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
