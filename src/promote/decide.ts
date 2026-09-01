import { isPassingConclusion } from '../checks';
import type { TagRelation } from '../github';
import type { WorkflowJobSummary } from '../types';

export interface PromotionFacts {
  tag: string;
  sha: string;
  selfWorkflowPath: string | null;
  jobs: ReadonlyArray<WorkflowJobSummary>;
  relation: TagRelation;
}

export interface Decision {
  move: boolean;
  exitCode: number;
  lines: string[];
}

const advance = (message: string): Decision => ({
  move: true,
  exitCode: 0,
  lines: [`::notice::${message}`],
});

const hold = (message: string): Decision => ({
  move: false,
  exitCode: 0,
  lines: [`::notice::${message}`],
});

const block = (message: string): Decision => ({
  move: false,
  exitCode: 1,
  lines: [`::error::${message}`],
});

const BY_RELATION: Record<TagRelation, (tag: string, sha: string) => Decision> = {
  missing: (tag, sha) => advance(`${tag} created at ${sha}`),
  ahead: (tag, sha) => advance(`${tag} → ${sha}`),
  identical: (tag, sha) => hold(`${tag} already points at ${sha}`),
  behind: (tag, sha) => hold(`${sha} is behind ${tag}; leaving ${tag} where it is`),
  diverged: (tag, sha) =>
    block(`${sha} is not a descendant of ${tag}; ${tag} points off this history`),
};

const nameList = (jobs: ReadonlyArray<WorkflowJobSummary>): string =>
  jobs.map((job) => job.name).join(', ');

export function decide({ tag, sha, selfWorkflowPath, jobs, relation }: PromotionFacts): Decision {
  if (selfWorkflowPath === null) {
    return block('GITHUB_WORKFLOW_REF is unset or malformed; cannot exclude this run from itself');
  }

  // This gate's own checks land on the commit it judges; counting them waits on itself.
  const observed = jobs.filter((job) => job.workflowPath !== selfWorkflowPath);
  if (observed.length === 0) {
    return block(`no other checks reported for ${sha}; refusing to move ${tag} on an empty result`);
  }

  const running = observed.filter((job) => job.status !== 'completed');
  if (running.length > 0) {
    return hold(`still running: ${nameList(running)}`);
  }

  const failing = observed.filter((job) => !isPassingConclusion(job.conclusion));
  if (failing.length > 0) {
    return hold(`${tag} held back: ${nameList(failing)} did not pass`);
  }

  return BY_RELATION[relation](tag, sha);
}
