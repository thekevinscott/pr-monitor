import type { WorkflowJobSummary, WorkflowRunSummary, Octokit } from '../types';

const PER_PAGE = 100;

export async function fetchWorkflowRunJobs(
  github: Octokit,
  owner: string,
  repo: string,
  runs: ReadonlyArray<WorkflowRunSummary>,
): Promise<WorkflowJobSummary[]> {
  const jobs: WorkflowJobSummary[] = [];

  for (const run of runs) {
    let page = 1;
    let batchSize = PER_PAGE;

    while (batchSize === PER_PAGE) {
      const response = await github.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: run.id,
        // Re-runs supersede their predecessors; only the latest attempt reports a check.
        filter: 'latest',
        per_page: PER_PAGE,
        page,
      });
      const batch = response.data.jobs;
      for (const j of batch) {
        jobs.push({
          id: j.id,
          name: j.name ?? '',
          workflowPath: run.path,
          status: j.status ?? '',
          conclusion: j.conclusion ?? null,
        });
      }
      batchSize = batch.length;
      page++;
    }
  }

  return jobs;
}
