import type { GateComparison } from '../types';

export interface ResultEffects {
  log: (msg: string) => void;
  setFailed: (msg: string) => void;
}

export function reportFinalResult(comparison: GateComparison, effects: ResultEffects): void {
  // A failed run is reported first because it explains the missing names that
  // usually come with it: once a job fails, the ones downstream of it never
  // report, and naming them would bury the cause.
  if (comparison.nonPassing.length > 0) {
    effects.setFailed(`Non-passing runs: ${JSON.stringify(comparison.nonPassing)}`);
    return;
  }
  if (comparison.missingNames.length > 0) {
    effects.setFailed(
      `Predicted check names that never reported: ${JSON.stringify(comparison.missingNames)}. ` +
        'Every predicted run finished, so these are not late — willfire and the ' +
        'checks GitHub created disagree. Likely a renamed or deleted job, or a ' +
        'matrix that stopped expanding to a combination.',
    );
    return;
  }
  effects.log(
    `${comparison.matchedNames.length} predicted check names reported across ` +
      `${comparison.matched.length} workflow runs, all passing`,
  );
}
