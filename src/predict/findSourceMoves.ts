import type { WorkflowSource } from 'willfire';
import { resolveSourceSha } from '../github';
import type { PredictClient } from '../types';

export interface SourceMove {
  source: WorkflowSource;
  sha: string | null;
}

export async function findSourceMoves(
  github: PredictClient,
  sources: ReadonlyArray<WorkflowSource>,
): Promise<SourceMove[]> {
  const moves: SourceMove[] = [];
  for (const source of sources) {
    if (source.ref === source.sha) continue;
    const sha = await resolveSourceSha(github, source);
    if (sha !== source.sha) moves.push({ source, sha });
  }
  return moves;
}
