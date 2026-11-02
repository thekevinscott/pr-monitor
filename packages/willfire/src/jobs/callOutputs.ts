import type { Scope } from "../expr/val.js";
import { renderTemplate } from "../execute/renderTemplate.js";
import type { ExecOutcome } from "../execute/types.js";
import { calleeInputs } from "./calleeInputs.js";
import type { ExpandJobsArgs } from "./expandJobs.js";
import { MAX_REUSABLE_DEPTH } from "./maxReusableDepth.js";
import { resolveCallee } from "./resolveCallee.js";
import { settleScope } from "./settleScope.js";
import { workflowCallOutputs } from "./workflowCallOutputs.js";
import type { Workflow } from "../types.js";

/** What a reusable-call job hands its `needs` readers: the callee's `workflow_call` outputs. */
export async function callOutputs(job: Workflow, scope: Scope, args: ExpandJobsArgs): Promise<ExecOutcome> {
  const uses = String(job["uses"]);
  const depth = args.depth ?? 0;
  if (depth + 1 > MAX_REUSABLE_DEPTH) {
    return { ok: false, reason: `reusable workflow nested deeper than ${MAX_REUSABLE_DEPTH} levels at ${uses}` };
  }
  // Each combination of a matrixed call writes the same outputs; which one lands is a race.
  if (job["strategy"] !== undefined) {
    return { ok: false, reason: `outputs of a matrixed call to ${uses}` };
  }
  const callee = await resolveCallee(uses, args.site, args.reader);
  if (!callee.ok) {
    return callee;
  }
  const declared = workflowCallOutputs(callee.wf);
  const reads = new Set(
    [...JSON.stringify(declared).matchAll(/jobs\.([A-Za-z_][\w-]*)\.outputs/g)].map((m) => m[1]),
  );
  const { scoped } = await settleScope(
    {
      ...args,
      wf: callee.wf,
      site: callee.site,
      depth: depth + 1,
      scope: {
        inputs: calleeInputs(job["with"], callee.wf, scope),
        github: scope.github,
        vars: scope.vars,
        varsComplete: scope.varsComplete,
      },
    },
    reads,
  );
  const outputs: Record<string, string> = {};
  for (const [name, value] of Object.entries(declared)) {
    const rendered = renderTemplate(value, { jobs: scoped.needs ?? {} });
    if (rendered === null) {
      return { ok: false, reason: `output '${name}' of ${uses} is undecided` };
    }
    outputs[name] = rendered;
  }
  return { ok: true, outputs };
}
