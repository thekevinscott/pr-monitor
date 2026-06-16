import type { Classification } from '../types';

export interface ResultEffects {
  log: (msg: string) => void;
  setFailed: (msg: string) => void;
}

export function reportFinalResult(classification: Classification, effects: ResultEffects): void {
  if (classification.nonPassing.length > 0) {
    effects.setFailed(`Non-passing runs: ${JSON.stringify(classification.nonPassing)}`);
    return;
  }
  if (classification.relevantCount === 0) {
    effects.log('No other workflow runs to monitor (minimum-checks is 0) - treating as docs-only PR');
    return;
  }
  effects.log(`All ${classification.relevantCount} workflow runs completed successfully`);
}
