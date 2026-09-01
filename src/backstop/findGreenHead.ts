import { readSurface } from '../promote/readSurface';
import type { TagComparison, TagRelation } from '../github';
import type { WorkflowJobSummary } from '../types';

export interface GreenCommit {
  sha: string;
  jobs: WorkflowJobSummary[];
  relation: TagRelation;
  aheadBy: number;
}

export interface GreenSearchIO {
  fetchJobs: (sha: string) => Promise<WorkflowJobSummary[]>;
  compare: (tag: string, sha: string) => Promise<TagComparison>;
}

// Stops at the first green commit, so a healthy repo costs one round of requests.
export async function findGreenHead(
  shas: ReadonlyArray<string>,
  tag: string,
  selfWorkflowPath: string | null,
  io: GreenSearchIO,
): Promise<GreenCommit | null> {
  for (const sha of shas) {
    const jobs = await io.fetchJobs(sha);
    if (readSurface({ selfWorkflowPath, jobs }).state !== 'green') continue;

    const { relation, aheadBy } = await io.compare(tag, sha);
    return { sha, jobs, relation, aheadBy };
  }

  return null;
}
