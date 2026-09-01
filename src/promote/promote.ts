import { decide } from './decide';
import type { TagRelation } from '../github/compareToTag';
import type { WorkflowJobSummary } from '../types';

export interface PromotionTarget {
  tag: string;
  sha: string;
  selfWorkflowPath: string | null;
}

export interface PromotionIO {
  fetchJobs: (sha: string) => Promise<WorkflowJobSummary[]>;
  compare: (tag: string, sha: string) => Promise<TagRelation>;
  moveTag: (tag: string, sha: string) => Promise<void>;
}

export interface Outcome {
  exitCode: number;
  lines: string[];
}

export async function promote(
  target: PromotionTarget,
  io: PromotionIO,
): Promise<Outcome> {
  const jobs = await io.fetchJobs(target.sha);
  const relation = await io.compare(target.tag, target.sha);
  const decision = decide({ ...target, jobs, relation });

  if (decision.move) {
    await io.moveTag(target.tag, target.sha);
  }

  return { exitCode: decision.exitCode, lines: decision.lines };
}
