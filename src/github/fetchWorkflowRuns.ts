import type { WorkflowRunSummary, Octokit } from '../types';

const PER_PAGE = 100;

export async function fetchWorkflowRuns(
  github: Octokit,
  owner: string,
  repo: string,
  headSha: string,
): Promise<WorkflowRunSummary[]> {
  const runs: WorkflowRunSummary[] = [];
  let page = 1;
  let batchSize = PER_PAGE;

  // Paginate: a busy repo can have more than one page of runs for a SHA.
  while (batchSize === PER_PAGE) {
    const response = await github.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      head_sha: headSha,
      per_page: PER_PAGE,
      page,
    });
    const batch = response.data.workflow_runs;
    for (const r of batch) {
      runs.push({
        id: r.id,
        name: r.name ?? '',
        status: r.status ?? '',
        conclusion: r.conclusion ?? null,
      });
    }
    batchSize = batch.length;
    page++;
  }

  return runs;
}
