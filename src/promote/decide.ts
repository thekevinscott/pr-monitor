import { isPassingConclusion } from '../checks';
import type { TagRelation } from '../github';
import type { WorkflowJobSummary } from '../types';

export interface PromotionFacts {
  tag: string;
  sha: string;
  /** Workflow file this gate is running from, or null when it cannot be read. */
  selfWorkflowPath: string | null;
  /** Every job reported against `sha`, this gate's own included. */
  jobs: ReadonlyArray<WorkflowJobSummary>;
  relation: TagRelation;
}

export interface Decision {
  move: boolean;
  exitCode: number;
  /** Workflow commands, written verbatim by the caller. */
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

/**
 * Whether the tag may advance to this commit, and what to say about it. Pure:
 * every fact it weighs is an argument, so the promotion rule is testable without
 * touching the API or the clock.
 *
 * Fails closed. Anything it cannot see clearly — its own identity, an empty job
 * list, a tag off this history — is an error, never a green light.
 */
export function decide({ tag, sha, selfWorkflowPath, jobs, relation }: PromotionFacts): Decision {
  if (selfWorkflowPath === null) {
    return block('GITHUB_WORKFLOW_REF is unset or malformed; cannot exclude this run from itself');
  }

  // This job's own checks land on the commit it is judging. Counting them means
  // waiting on a job that is waiting on itself, and the tag never moves.
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
