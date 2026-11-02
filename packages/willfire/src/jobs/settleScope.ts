import type { Scope } from "../expr/val.js";
import { absentInputs } from "./absentInputs.js";
import { evalIf } from "./evalIf.js";
import type { ExpandJobsArgs } from "./expandJobs.js";
import { jobScope } from "./jobScope.js";
import { neededJobIds } from "./neededJobIds.js";
import { outcomeOf } from "./outcomeOf.js";
import { readsVars } from "./readsVars.js";
import type { Workflow } from "../types.js";

export interface Settled {
  scoped: Scope;
  execFailures: Record<string, string>;
}

/**
 * The scope a workflow's jobs are judged under: inputs, vars, and the outputs
 * of every job some read depends on. `also` names jobs read from outside the
 * file's own jobs — a `workflow_call` output's `jobs.*`.
 */
export async function settleScope(args: ExpandJobsArgs, also: ReadonlySet<string> = new Set()): Promise<Settled> {
  const { wf, scope = {} } = args;
  const jobs = (wf["jobs"] ?? {}) as Record<string, Workflow>;

  // Nothing dispatched or called this run, so an input this workflow declares
  // and nothing supplied reads as the empty string (#125) — laid under, never
  // over, whatever the caller bound.
  let scoped: Scope = { ...scope, inputs: { ...absentInputs(wf), ...scope.inputs } };
  if (scoped.vars === undefined && args.vars !== undefined && readsVars(jobs)) {
    scoped = { ...scoped, ...(await args.vars()) };
  }

  // Selection is derived, never configured: execute exactly the jobs some
  // read depends on, under the same `evalIf` verdict the main loop applies.
  const execFailures: Record<string, string> = {};
  const needed = new Set([...neededJobIds(jobs), ...also]);
  for (const [jobId, jobRaw] of Object.entries(jobs)) {
    const job = jobRaw ?? {};
    if (needed.has(jobId) && evalIf(job.if, jobScope(job, scoped)) === "run") {
      const res = await outcomeOf(jobId, job, scoped, args);
      if (res?.ok === true) {
        scoped = { ...scoped, needs: { ...scoped.needs, [jobId]: { outputs: res.outputs } } };
      } else if (res !== null) {
        execFailures[jobId] = res.reason;
      }
    }
  }
  return { scoped, execFailures };
}
