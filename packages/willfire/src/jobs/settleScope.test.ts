import { describe, expect, it, vi } from "vitest";
import { settleScope } from "./settleScope.js";
import type { ExpandJobsArgs } from "./expandJobs.js";
import type { JobExecutor } from "../execute/types.js";
import type { JobSite, Workflow, WorkflowSource } from "../types.js";

vi.mock(
  "./absentInputs.js",
  async () => await vi.importActual<typeof import("./absentInputs.js")>("./absentInputs.js"),
);
vi.mock(
  "./neededJobIds.js",
  async () => await vi.importActual<typeof import("./neededJobIds.js")>("./neededJobIds.js"),
);
vi.mock(
  "./readsVars.js",
  async () => await vi.importActual<typeof import("./readsVars.js")>("./readsVars.js"),
);
vi.mock(
  "./outcomeOf.js",
  async () => await vi.importActual<typeof import("./outcomeOf.js")>("./outcomeOf.js"),
);

const SHA = "a".repeat(40);
const SOURCE: WorkflowSource = { owner: "o", repo: "r", ref: SHA, sha: SHA };
const SITE: JobSite = { path: ".github/workflows/w.yml", source: SOURCE };

const recording = (byJob: Record<string, Awaited<ReturnType<JobExecutor["executeJob"]>>>) => {
  const executed: string[] = [];
  const executor: JobExecutor = {
    executeJob: async (jobId) => {
      executed.push(jobId);
      return byJob[jobId] ?? { ok: true, outputs: {} };
    },
  };
  return { executed, executor };
};

const args = (wf: Workflow, extra: Partial<ExpandJobsArgs> = {}): ExpandJobsArgs => ({
  wf,
  reader: { fetchWorkflow: async () => null, resolveRef: async () => null },
  site: SITE,
  ...extra,
});

describe("settleScope", () => {
  it("lays declared-but-absent inputs under the ones bound", async () => {
    const wf = { on: { workflow_call: { inputs: { a: {}, b: {} } } }, jobs: {} };
    const { scoped } = await settleScope(args(wf, { scope: { inputs: { a: { kind: "value", v: "x" } } } }));
    expect(scoped.inputs).toEqual({ a: { kind: "value", v: "x" }, b: { kind: "value", v: "" } });
  });

  it("loads vars only for a workflow that reads them, and never over vars already bound", async () => {
    const vars = vi.fn(async () => ({ vars: { V: "1" }, varsComplete: true }));
    const reads = { jobs: { a: { if: "vars.V == '1'" } } };
    expect((await settleScope(args(reads, { vars }))).scoped.vars).toEqual({ V: "1" });
    expect((await settleScope(args({ jobs: { a: {} } }, { vars }))).scoped.vars).toBeUndefined();
    expect((await settleScope(args(reads, { vars, scope: { vars: {} } }))).scoped.vars).toEqual({});
    expect(vars).toHaveBeenCalledTimes(1);
  });

  it("executes the jobs a sibling reads plus the ones named from outside, when they run", async () => {
    const { executed, executor } = recording({ a: { ok: true, outputs: { x: "1" } } });
    const wf = {
      jobs: {
        a: { steps: [] },
        b: { needs: "a", if: "needs.a.outputs.x == '1'" },
        c: { steps: [] },
        d: { if: false, steps: [] },
        e: { steps: [] },
      },
    };
    const { scoped, execFailures } = await settleScope(args(wf, { executor }), new Set(["c", "d"]));
    expect(executed).toEqual(["a", "c"]);
    expect(scoped.needs).toEqual({ a: { outputs: { x: "1" } }, c: { outputs: {} } });
    expect(execFailures).toEqual({});
  });

  it("records why a needed job has no outputs, and skips one nothing can run", async () => {
    const { executor } = recording({ a: { ok: false, reason: "boom" } });
    const wf = { jobs: { a: { steps: [] }, b: { needs: "a", if: "needs.a.outputs.x" } } };
    expect(await settleScope(args(wf, { executor }))).toMatchObject({
      execFailures: { a: "executing 'a' failed: boom" },
    });
    const bare = await settleScope(args(wf));
    expect(bare.execFailures).toEqual({});
    expect(bare.scoped.needs).toBeUndefined();
  });

  it("treats a null job body as empty and a workflow with no jobs as nothing to run", async () => {
    const { executed, executor } = recording({});
    await settleScope(args({ jobs: { a: null } }, { executor }), new Set(["a"]));
    expect(executed).toEqual(["a"]);
    expect((await settleScope(args({}, { executor }))).execFailures).toEqual({});
  });
});
