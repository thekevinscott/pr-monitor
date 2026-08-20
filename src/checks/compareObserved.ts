import type {
  WorkflowRunSummary,
  WorkflowJobSummary,
  ExpectedChecks,
  GateComparison,
} from '../types';
import { isPassingConclusion } from './isPassingConclusion';

/**
 * Compare what GitHub actually created against what willfire predicted.
 *
 * Set membership is judged on check names — the string a required status check
 * keys on — so a renamed, deleted, or no-longer-expanded job is divergence even
 * when its workflow still runs and still goes green.
 *
 * Whether a check *passed* is still judged on the run. A job's own conclusion
 * lies about `continue-on-error: true` (job fails, run succeeds, the check
 * reports green), and a `startup_failure` run has no jobs to ask.
 */
export function compareObserved(
  runs: ReadonlyArray<WorkflowRunSummary>,
  jobs: ReadonlyArray<WorkflowJobSummary>,
  expected: ExpectedChecks,
): GateComparison {
  const expectedRuns = new Set(expected.workflows);
  const expectedNames = new Set(expected.names);

  const unexpected = new Set<string>();
  const seen = new Set<string>();
  const matched: string[] = [];
  const inProgress: string[] = [];
  const nonPassing: string[] = [];

  for (const { path, status, conclusion } of runs) {
    if (!expectedRuns.has(path)) {
      unexpected.add(path);
      continue;
    }
    seen.add(path);
    matched.push(path);
    if (status !== 'completed') {
      inProgress.push(path);
    } else if (!isPassingConclusion(conclusion)) {
      nonPassing.push(`${path} (${conclusion})`);
    }
  }

  const unexpectedNames = new Set<string>();
  const seenNames = new Set<string>();

  for (const { name, workflowPath } of jobs) {
    if (expectedNames.has(name)) {
      seenNames.add(name);
      continue;
    }
    // The whole run is already reported as unpredicted; listing each of its jobs
    // again says nothing new.
    if (!expectedRuns.has(workflowPath)) continue;
    unexpectedNames.add(`${workflowPath} :: ${name}`);
  }

  return {
    unexpected: [...unexpected].sort(),
    unexpectedNames: [...unexpectedNames].sort(),
    missing: expected.workflows.filter((path) => !seen.has(path)),
    missingNames: expected.names.filter((name) => !seenNames.has(name)),
    matchedNames: expected.names.filter((name) => seenNames.has(name)),
    matched,
    inProgress,
    nonPassing,
  };
}
