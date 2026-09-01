import type {
  WorkflowRunSummary,
  WorkflowJobSummary,
  ExpectedChecks,
  GateComparison,
} from '../types';
import { isPassingConclusion } from './isPassingConclusion';

/**
 * Membership is judged on check names; whether one passed is judged on the run, because a
 * job's own conclusion lies about `continue-on-error: true`.
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
