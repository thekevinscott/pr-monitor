import type { WorkflowJobSummary, WorkflowRunSummary, Octokit } from '../types';

const PER_PAGE = 100;

/**
 * The jobs of the given runs, flattened. A job's `name` is the check name
 * GitHub created, so this is the observed side of the check-name comparison —
 * the runs endpoint alone cannot supply it.
 *
 * Only the runs the caller passes are queried, so filtering the gate's own run
 * out of `runs` also keeps its checks off the observed side.
 */
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

    // Paginate: a wide matrix can put a single run over one page of jobs.
    while (batchSize === PER_PAGE) {
      const response = await github.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: run.id,
        // Re-runs supersede their predecessors; only the latest attempt reports
        // a check, so only it belongs in the observed set.
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
