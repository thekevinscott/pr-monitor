import type { WorkflowSource } from 'willfire';
import { resolveSourceSha } from '../github';
import type { PredictClient } from '../types';

export interface SourceMove {
  /** The source as the prediction recorded it, carrying the commit it read. */
  source: WorkflowSource;
  /** The commit the ref names now, or null when it no longer resolves. */
  sha: string | null;
}

/**
 * Re-resolve the refs a prediction was read from and report the ones that no
 * longer name the same commit.
 *
 * A source whose `ref` is already its commit is skipped: a SHA cannot move, so
 * asking would spend a request to learn nothing. That covers the PR's own head,
 * which willfire records by SHA.
 */
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
