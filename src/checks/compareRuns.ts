import type { WorkflowRunSummary, ExpectedWorkflows, RunComparison } from '../types';
import { isPassingConclusion } from './isPassingConclusion';

/** Compare the runs GitHub actually created against the ones willfire predicted. */
export function compareRuns(
  runs: ReadonlyArray<WorkflowRunSummary>,
  expected: ExpectedWorkflows,
): RunComparison {
  const known = new Set([...expected.required, ...expected.tolerated]);

  const unexpected = new Set<string>();
  const seen = new Set<string>();
  const matched: string[] = [];
  const inProgress: string[] = [];
  const nonPassing: string[] = [];

  for (const { path, status, conclusion } of runs) {
    if (!known.has(path)) {
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

  return {
    unexpected: [...unexpected].sort(),
    missing: expected.required.filter((path) => !seen.has(path)),
    matched,
    inProgress,
    nonPassing,
  };
}
