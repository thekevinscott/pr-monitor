import type { GateComparison } from '../types';

/**
 * The shape in which a never-started run becomes decidable: nothing is still running
 * that could yet create the absent ones.
 */
export function isStalled(comparison: GateComparison): boolean {
  return comparison.missing.length > 0 && comparison.inProgress.length === 0;
}
