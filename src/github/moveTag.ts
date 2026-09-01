import type { Octokit } from '../types';
import { isNotFound } from './isNotFound';

/** A ref update writes no object, so nothing here needs signing. */
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
