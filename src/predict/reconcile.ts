import { predict, type PredictOptions, type WorkflowSource } from 'willfire';
import type { ExpectedChecks, PredictClient } from '../types';
import { formatSourceMoves } from '../messages/formatSourceMoves';
import { formatUnresolvedFailure } from '../messages/formatUnresolvedFailure';
import { expectedChecks } from './expectedChecks';
import { findSourceMoves } from './findSourceMoves';

export interface ReconcileParams {
  github: PredictClient;
  slug: string;
  pullNumber: number;
  options: PredictOptions;
  selfPath: string;
  sources: ReadonlyArray<WorkflowSource>;
}

export type Reconciliation =
  | { kind: 'unchanged' }
  | { kind: 'failed'; detail: string }
  | { kind: 'repredicted'; expected: ExpectedChecks; detail: string };

/** Re-predicting executes granted jobs, so re-resolve first and predict only if something moved. */
export async function reconcile({
  github,
  slug,
  pullNumber,
  options,
  selfPath,
  sources,
}: ReconcileParams): Promise<Reconciliation> {
  const moves = await findSourceMoves(github, sources);
  if (moves.length === 0) return { kind: 'unchanged' };

  const unreadable = moves.filter((move) => move.sha === null);
  if (unreadable.length > 0) {
    return {
      kind: 'failed',
      detail: `Reconciliation could not run: ${formatSourceMoves(unreadable)}.`,
    };
  }

  const prediction = await predict(github, slug, pullNumber, options);
  const expected = expectedChecks(prediction, selfPath);
  const moved = `Refs behind the prediction moved: ${formatSourceMoves(moves)}.`;
  if (expected.unresolved.length > 0) {
    return { kind: 'failed', detail: `${moved} ${formatUnresolvedFailure(expected.unresolved)}` };
  }
  return {
    kind: 'repredicted',
    expected,
    detail: `${moved} Re-predicted at the new commits.`,
  };
}
