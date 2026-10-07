import type { Prediction } from 'willfire';

/** Workflows whose entries change when nothing is executed: their names hang on execution. */
export function executionDependent(executed: Prediction, unexecuted: Prediction): string[] {
  const shape = (prediction: Prediction, path: string): string =>
    JSON.stringify(
      prediction.entries
        .filter((entry) => entry.workflow === path)
        .map((entry) => JSON.stringify([entry.job, entry.checkName, entry.status]))
        .sort(),
    );
  const paths = new Set([...executed.entries, ...unexecuted.entries].map((entry) => entry.workflow));
  return [...paths].filter((path) => shape(executed, path) !== shape(unexecuted, path)).sort();
}
