import type { Scope } from "../expr/val.js";
import type { Workflow } from "../types.js";

/** An `environment:` brings variables the repo listing never shows. */
export function jobScope(job: Workflow, scope: Scope): Scope {
  return job["environment"] === undefined ? scope : { ...scope, varsComplete: false };
}
