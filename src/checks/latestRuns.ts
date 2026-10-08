import type { WorkflowRunSummary } from '../types';

/** Re-triggers on one SHA leave siblings behind; a cancel is no verdict, so it never supersedes. */
export function latestRuns(runs: ReadonlyArray<WorkflowRunSummary>): WorkflowRunSummary[] {
  const live = (r: WorkflowRunSummary): boolean => r.conclusion !== 'cancelled';
  const latest = new Map<string, WorkflowRunSummary>();
  for (const run of runs) {
    const key = `${run.path}\n${run.event}`;
    const held = latest.get(key);
    const supersedes =
      held === undefined || (live(run) === live(held) ? run.id > held.id : live(run));
    if (supersedes) latest.set(key, run);
  }
  return [...latest.values()];
}
