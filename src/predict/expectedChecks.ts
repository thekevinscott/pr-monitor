import type { Prediction } from 'willfire';
import type { ExpectedChecks } from '../types';

/**
 * Turn willfire's job-level entries into the check names this PR must produce.
 *
 * Check names, not workflow files, are what the gate protects: a required status
 * check keys on the job's name, so a workflow can dispatch, go green, and still
 * have renamed, dropped, or stopped expanding a job that something depends on.
 *
 * Workflow paths are collected too, but for a narrower job. A run can reach a
 * terminal conclusion without creating a single job — `startup_failure` creates
 * none — and a comparison made only of names cannot see that run at all.
 *
 * Three shapes of entry, three treatments:
 *
 *   - `checkName` set: the name must report. `skipped` and `unknown` entries are
 *     included, because GitHub creates the check either way — a skipped job is
 *     still a check, concluded `skipped`.
 *   - `checkName: null` with `job === '*'`: a workflow-level verdict. willfire is
 *     speaking about the file, not a job in it, so there is no name to expect;
 *     the run alone is required.
 *   - `checkName: null` with a real job: willfire can see the job but cannot name
 *     its checks (a dynamic matrix). See `unresolved` in `ExpectedChecks`.
 */
export function expectedChecks(prediction: Prediction, selfPath: string): ExpectedChecks {
  const names = new Set<string>();
  const workflows = new Set<string>();
  const unresolved = new Set<string>();

  for (const entry of prediction.entries) {
    // The gate's own workflow is out of scope on both sides of the comparison.
    if (entry.workflow === selfPath) continue;
    if (entry.status === 'no-dispatch') continue;

    workflows.add(entry.workflow);

    // Loose on purpose: null and absent are the same fact — willfire has no name
    // for this entry — and both belong on the same side of the branch.
    if (entry.checkName != null) {
      names.add(entry.checkName);
      continue;
    }
    if (entry.job === '*') continue;
    unresolved.add(`${entry.workflow} :: ${entry.job} (${entry.reason})`);
  }

  return {
    names: [...names].sort(),
    workflows: [...workflows].sort(),
    unresolved: [...unresolved].sort(),
  };
}
