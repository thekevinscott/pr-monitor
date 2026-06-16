import type { WorkflowRunSummary, Classification } from '../types';
import { isPassingConclusion } from './isPassingConclusion';

export function classifyWorkflowRuns(
  runs: ReadonlyArray<WorkflowRunSummary>,
  excludedNames: ReadonlyArray<string>,
): Classification {
  const inProgress: string[] = [];
  const nonPassing: string[] = [];
  let relevantCount = 0;

  for (const { name, status, conclusion } of runs) {
    if (excludedNames.includes(name)) continue;
    relevantCount++;

    if (status !== 'completed') {
      inProgress.push(name);
    } else if (!isPassingConclusion(conclusion)) {
      nonPassing.push(`${name} (${conclusion})`);
    }
  }

  return { inProgress, nonPassing, relevantCount };
}
