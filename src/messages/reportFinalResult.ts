import type { RunComparison } from '../types';

export interface ResultEffects {
  log: (msg: string) => void;
  setFailed: (msg: string) => void;
}

export function reportFinalResult(comparison: RunComparison, effects: ResultEffects): void {
  if (comparison.nonPassing.length > 0) {
    effects.setFailed(`Non-passing runs: ${JSON.stringify(comparison.nonPassing)}`);
    return;
  }
  effects.log(`${comparison.matched.length} predicted workflow runs completed successfully`);
}
