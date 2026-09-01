import { readSurface } from './readSurface';
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

// Pure, so the promotion rule is testable without touching the API or the clock.
export function decide({ tag, sha, selfWorkflowPath, jobs, relation }: PromotionFacts): Decision {
  const { state, names } = readSurface({ selfWorkflowPath, jobs });

  switch (state) {
    case 'unreadable':
      return block('GITHUB_WORKFLOW_REF is unset or malformed; cannot exclude this run from itself');
    case 'empty':
      return block(`no other checks reported for ${sha}; refusing to move ${tag} on an empty result`);
    case 'running':
      return hold(`still running: ${names.join(', ')}`);
    case 'failing':
      return hold(`${tag} held back: ${names.join(', ')} did not pass`);
    case 'green':
      return BY_RELATION[relation](tag, sha);
  }
}
