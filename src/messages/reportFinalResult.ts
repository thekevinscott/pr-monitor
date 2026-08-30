import type { GateComparison } from '../types';

export interface ResultEffects {
  log: (msg: string) => void;
  setFailed: (msg: string) => void;
}

/**
 * The verdict once every predicted run has finished.
 *
 * Set membership is already settled by then — `describeDivergence` fails the
 * gate before it gets here — so the only question left is whether what ran
 * passed.
 */
export function reportFinalResult(comparison: GateComparison, effects: ResultEffects): void {
  if (comparison.nonPassing.length > 0) {
    effects.setFailed(`Non-passing runs: ${JSON.stringify(comparison.nonPassing)}`);
    return;
  }
  effects.log(
    `${comparison.matchedNames.length} predicted check names reported across ` +
      `${comparison.matched.length} workflow runs, all passing`,
  );
}
