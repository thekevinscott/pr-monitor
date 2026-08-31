import type { Octokit } from '../types';
import { isNotFound } from './isNotFound';

/**
 * Repoint a lightweight tag at a commit, creating it if it does not exist yet.
 *
 * A ref update writes no object, so nothing here needs signing — the commit
 * being tagged was pushed, and signed, by whoever landed it.
 */
export async function moveTag(
  github: Octokit,
  owner: string,
  repo: string,
  tag: string,
  sha: string,
): Promise<void> {
  try {
    await github.rest.git.updateRef({ owner, repo, ref: `tags/${tag}`, sha, force: true });
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await github.rest.git.createRef({ owner, repo, ref: `refs/tags/${tag}`, sha });
  }
}
