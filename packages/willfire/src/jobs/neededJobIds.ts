import type { Workflow } from "../types.js";

/**
 * The jobs some sibling reads outputs from — the only jobs worth executing.
 * Matching over the serialized job catches every read site without modelling
 * any; a false positive costs one wasted run, never a verdict.
 */
export function neededJobIds(jobs: Record<string, Workflow>): Set<string> {
  const needed = new Set<string>();
  const re = /needs\s*\.\s*([A-Za-z_][A-Za-z0-9_-]*)\s*\.\s*outputs\b/g;
  for (const job of Object.values(jobs)) {
    for (const m of JSON.stringify(job ?? {}).matchAll(re)) {
      needed.add(m[1]);
    }
  }
  return needed;
}
