import { decidedInputs } from "../callback/decidedInputs.js";
import { jobKey } from "../callback/jobKey.js";
import { matchOutputs } from "../callback/matchOutputs.js";
import type { Scope } from "../expr/val.js";
import type { ExecOutcome } from "../execute/types.js";
import { callOutputs } from "./callOutputs.js";
import type { ExpandJobsArgs } from "./expandJobs.js";
import { jobScope } from "./jobScope.js";
import type { Workflow } from "../types.js";

/** A job's outputs, the reason it has none, or null when nothing can run it. */
export async function outcomeOf(
  jobId: string,
  job: Workflow,
  scoped: Scope,
  args: ExpandJobsArgs,
): Promise<ExecOutcome | null> {
  const answer = matchOutputs(args.callbacks ?? {}, jobKey(args.site, jobId), decidedInputs(scoped));
  if (answer.kind === "ambiguous") {
    // Two recorded answers claiming one invocation: either pick would be a
    // guess wearing a recorded answer's face, so the whole prediction aborts.
    throw new Error(answer.reason);
  }
  if (answer.kind === "hit") {
    return { ok: true, outputs: answer.outputs };
  }
  if (answer.kind === "no-match") {
    return { ok: false, reason: answer.reason };
  }
  const res =
    "uses" in job
      ? await callOutputs(job, jobScope(job, scoped), args)
      : args.executor === undefined
        ? null
        : await args.executor.executeJob(jobId, job, args.wf, jobScope(job, scoped));
  return res === null || res.ok ? res : { ok: false, reason: `executing '${jobId}' failed: ${res.reason}` };
}
