import type { Prediction } from 'willfire';
import type { ExpectedChecks } from '../types';

export function expectedChecks(prediction: Prediction, selfPath: string): ExpectedChecks {
  const names = new Set<string>();
  const workflows = new Set<string>();
  const unresolved = new Set<string>();

  for (const entry of prediction.entries) {
    if (entry.workflow === selfPath) continue;
    if (entry.status === 'no-dispatch') continue;

    workflows.add(entry.workflow);

    // Loose on purpose: null and absent are the same fact here.
    if (entry.checkName != null) {
      names.add(entry.checkName);
      continue;
    }
    if (entry.job === '*') continue;
    unresolved.add(`${entry.workflow} :: ${entry.job} (${entry.reason})`);
  }

  return {
    names: [...names].sort(),
    workflows: [...workflows].sort(),
    unresolved: [...unresolved].sort(),
  };
}
