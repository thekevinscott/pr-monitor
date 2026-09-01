import type { Octokit } from '../types';

/** GitHub's page cap. The walk reads one page, so it also bounds the depth. */
export const MAX_COMMITS = 100;

export interface CommitNode {
  sha: string;
  /** First parent, or null for a root commit. */
  parent: string | null;
}

export async function listBranchCommits(
  github: Octokit,
  owner: string,
  repo: string,
  branch: string,
  depth: number,
): Promise<CommitNode[]> {
  const { data } = await github.rest.repos.listCommits({
    owner,
    repo,
    sha: branch,
    per_page: depth,
  });
  return data.map((commit) => ({ sha: commit.sha, parent: commit.parents[0]?.sha ?? null }));
}
