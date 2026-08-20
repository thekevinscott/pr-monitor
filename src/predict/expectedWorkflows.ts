import type { Prediction } from 'willfire';
import type { ExpectedWorkflows } from '../types';

/**
 * Reduce willfire's job-level entries to the workflow files that must produce a
 * run for this PR.
 *
 * The gate compares at workflow-run granularity, not job granularity: a run
 * stays non-terminal until every one of its jobs finishes, so a job-level
 * `unknown` (dynamic matrix, non-local reusable workflow) needs no special
 * handling — the run exists either way and still has to go green.
 *
 * There is exactly one set. Anything willfire does not call `no-dispatch` must
 * appear, and anything outside the set is a surprise. willfire settles every
 * workflow-level verdict, so no entry arrives undecided.
 */
export function expectedWorkflows(
  prediction: Prediction,
  selfPath: string,
): ExpectedWorkflows {
  const required = new Set<string>();

  for (const entry of prediction.entries) {
    // The gate's own workflow is out of scope on both sides of the comparison.
    if (entry.workflow === selfPath) continue;
    if (entry.status === 'no-dispatch') continue;
    required.add(entry.workflow);
  }

  return { required: [...required].sort() };
}
