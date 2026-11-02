import type { CallbackMap } from "../callback/parseCallbackMap.js";
import type { Scope } from "../expr/val.js";
import type { JobExecutor } from "../execute/types.js";
import { expandMatrixDetailed } from "../matrix/expandMatrixDetailed.js";
import { capDisplayName } from "../names/capDisplayName.js";
import { jobDisplayName } from "../names/jobDisplayName.js";
import { skippedDisplayName } from "../names/skippedDisplayName.js";
import { calleeInputs } from "./calleeInputs.js";
import { jobScope } from "./jobScope.js";
import { MAX_REUSABLE_DEPTH } from "./maxReusableDepth.js";
import { prScope } from "./prScope.js";
import { resolveCallee } from "./resolveCallee.js";
import { resolveStatuses } from "./resolveStatuses.js";
import { settleScope } from "./settleScope.js";
import { startupFailure } from "./startupFailure.js";
import type { ExpandedJob, JobSite, Workflow, WorkflowReader } from "../types.js";

/**
 * Exceeding the limit anywhere fails the whole run at validation: zero jobs,
 * zero checks, legal sibling branches included (willfire#342, run 36417461106).
 * Thrown so the workflow's expansion collapses instead of one entry.
 */
export class ReusableDepthError extends Error {
  constructor(uses: string) {
    super(`reusable workflow nested deeper than ${MAX_REUSABLE_DEPTH} levels at ${uses}`);
  }
}

export interface ExpandJobsArgs {
  wf: Workflow;
  reader: WorkflowReader;
  site: JobSite;
  depth?: number;
  prefix?: string;
  prefixResolved?: boolean;
  scope?: Scope;
  /**
   * Memoized repo-variables read, awaited only for a workflow that mentions
   * `vars` in its jobs — which keeps the API call off every prediction that
   * never needs it.
   */
  vars?: () => Promise<Pick<Scope, "vars" | "varsComplete">>;
  executor?: JobExecutor;
  callbacks?: CallbackMap;
}

export async function expandJobs(args: ExpandJobsArgs): Promise<ExpandedJob[]> {
  const {
    wf,
    reader,
    site,
    depth = 0,
    prefix = "",
    prefixResolved = true,
  } = args;
  const entries: ExpandedJob[] = [];
  const jobs = (wf["jobs"] ?? {}) as Record<string, Workflow>;
  const { scoped, execFailures } = await settleScope(args);
  const execNote = (needs: string[]): string => {
    const failed = needs.find((n) => n in execFailures);
    return failed === undefined ? "" : `; ${execFailures[failed]}`;
  };

  // Statuses settle ahead of the emit loop because `needs:` may point at a job
  // declared later in the file; entries stay in declaration order.
  const verdicts = resolveStatuses(jobs, scoped);

  for (const [jobId, jobRaw] of Object.entries(jobs)) {
    const job = jobRaw ?? {};
    const { status, reason, needs } = verdicts[jobId];

    // A skipped job never expands its matrix and never dispatches a called
    // workflow: it collapses to a single check under the bare job name.
    if (status === "skipped") {
      const disp = skippedDisplayName(jobId, job);
      const name = prefix + disp.name;
      entries.push({
        job: name,
        checkName: prefixResolved && disp.resolved ? name : null,
        status,
        reason,
      });
    } else if (status === "unknown" && "uses" in job) {
      // The guard picks between two check sets: the caller's own name if it
      // skips (probe willfire#352 ran `callvars`), the callee's if it
      // dispatches. Only the caller's is nameable, so the callee's stay out
      // (#269) and the caller's no longer goes missing.
      const name = prefix + skippedDisplayName(jobId, job).name;
      entries.push({
        job: name,
        checkName: prefixResolved ? name : null,
        status,
        reason,
      });
    } else if ("uses" in job) {
      // Reusable workflow call. The calling job produces no check of its own;
      // each called job becomes `<calling job name> / <called job name>`, and
      // a matrix on the *caller* multiplies the whole callee set. A cross-repo
      // call names its checks exactly the same way a local one does — probe
      // PR #9, `call-remote-tag / r-inner` alongside `call-plain / inner`.
      const uses = job["uses"] as string;
      if (depth + 1 > MAX_REUSABLE_DEPTH) {
        throw new ReusableDepthError(uses);
      }
      const combos = expandMatrixDetailed(job.strategy, prScope(jobScope(job, scoped)));
      if (combos === null) {
        entries.push({
          job: prefix + jobId,
          checkName: null,
          status: "unknown",
          reason: "dynamic matrix on reusable workflow call" + execNote(needs),
        });
      } else {
        // Resolve the called workflow once, not once per matrix combination.
        // A callee GitHub cannot read fails the whole run before any job is
        // scheduled, so this cannot stay a verdict on the calling job alone.
        const callee = await resolveCallee(uses, site, reader);
        if (!callee.ok) {
          throw startupFailure(callee.reason);
        }
        const { wf: subWf, site: subSite } = callee;

        for (const combo of combos) {
          const disp = jobDisplayName(jobId, job, combo, scoped.github);
          const baseName = prefix + disp.name;
          const nameResolved = prefixResolved && disp.resolved;
          // `inputs.*` changes at the call boundary; `github.*` and `vars.*`
          // do not. A callee's jobs run in the caller's repo, so the facts
          // seeded at the top of the prediction stay true all the way down.
          // Evaluated per combination: a `with:` may read `matrix.*`, and each
          // combination dispatches its own callee run with its own inputs.
          const subScope: Scope = {
            inputs: calleeInputs(
              job.with,
              subWf,
              combo === null ? scoped : { ...scoped, matrix: combo.values },
            ),
            github: scoped.github,
            vars: scoped.vars,
            varsComplete: scoped.varsComplete,
          };
          entries.push(
            ...(await expandJobs({
              ...args,
              wf: subWf,
              site: subSite,
              depth: depth + 1,
              prefix: `${baseName} / `,
              prefixResolved: nameResolved,
              scope: subScope,
            })),
          );
        }
      }
    } else {
      const combos = expandMatrixDetailed(job.strategy, prScope(jobScope(job, scoped)));
      if (combos === null) {
        entries.push({
          job: prefix + jobId,
          checkName: null,
          status: "unknown",
          reason: "dynamic matrix" + execNote(needs),
        });
      } else {
        for (const combo of combos) {
          const disp = jobDisplayName(jobId, job, combo, scoped.github);
          const name = prefix + capDisplayName(disp.name);
          entries.push({
            job: name,
            checkName: prefixResolved && disp.resolved ? name : null,
            status,
            reason,
          });
        }
      }
    }
  }
  return entries;
}
