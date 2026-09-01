import { predict, type PredictOptions, type WorkflowSource } from 'willfire';
import type { ExpectedChecks, PredictClient } from '../types';
import { formatSourceMoves } from '../messages/formatSourceMoves';
import { formatUnresolvedFailure } from '../messages/formatUnresolvedFailure';
import { expectedChecks } from './expectedChecks';
import { findSourceMoves } from './findSourceMoves';

export interface ReconcileParams {
  github: PredictClient;
  /** `owner/name`, as `predict` takes it. */
  slug: string;
  pullNumber: number;
  options: PredictOptions;
  selfPath: string;
  /** The sources the divergent prediction was read from. */
  sources: ReadonlyArray<WorkflowSource>;
}

export type Reconciliation =
  /** Every ref still names the commit it did; the divergence is real. */
  | { kind: 'unchanged' }
  /** Something moved, but the fresh answer is no more usable than the old one. */
  | { kind: 'failed'; detail: string }
  /** Something moved, and here is what the new commits predict. */
  | { kind: 'repredicted'; expected: ExpectedChecks; detail: string };

/**
 * Decide whether a divergence is a moved `uses:` tag rather than a real
 * disagreement, and if so what the new commits predict.
 *
 * Re-resolving first, and predicting only when something actually moved, is
 * what keeps this cheap and safe: a prediction with grants executes real code,
 * and doing that again to confirm a tag that never moved would be a cost and a
 * risk with no answer attached.
 *
 * Called at most once per gate run. Reconciling repeatedly would be a search
 * for a prediction that agrees, which is the opposite of gating on one.
 */
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

  // A ref that stopped resolving leaves the gate unable to name the commits
  // behind its own answer, which is exactly the state it must not guess from.
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
