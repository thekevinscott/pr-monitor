import type { CheckRunSummary, Octokit } from './types';

export async function fetchCheckRuns(
  github: Octokit,
  owner: string,
  repo: string,
  ref: string,
): Promise<CheckRunSummary[]> {
  const response = await github.rest.checks.listForRef({ owner, repo, ref, per_page: 100 });
  return response.data.check_runs;
}
