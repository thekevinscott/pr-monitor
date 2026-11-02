import { describe, expect, it, vi } from "vitest";
import { outcomeOf } from "./outcomeOf.js";
import type { ExpandJobsArgs } from "./expandJobs.js";
import type { JobExecutor } from "../execute/types.js";
import type { JobSite, WorkflowSource } from "../types.js";

vi.mock(
  "../callback/matchOutputs.js",
  async () => await vi.importActual<typeof import("../callback/matchOutputs.js")>("../callback/matchOutputs.js"),
);
vi.mock(
  "../callback/decidedInputs.js",
  async () => await vi.importActual<typeof import("../callback/decidedInputs.js")>("../callback/decidedInputs.js"),
);
vi.mock(
  "./callOutputs.js",
  async () => await vi.importActual<typeof import("./callOutputs.js")>("./callOutputs.js"),
);

const SHA = "a".repeat(40);
const SOURCE: WorkflowSource = { owner: "o", repo: "r", ref: SHA, sha: SHA };
const SITE: JobSite = { path: ".github/workflows/w.yml", source: SOURCE };
const KEY = "o/r/.github/workflows/w.yml:detect";

const args = (extra: Partial<ExpandJobsArgs> = {}): ExpandJobsArgs => ({
  wf: { jobs: {} },
  reader: { fetchWorkflow: async () => null, resolveRef: async () => null },
  site: SITE,
  ...extra,
});

const executor = (res: Awaited<ReturnType<JobExecutor["executeJob"]>>): JobExecutor => ({
  executeJob: vi.fn(async () => res),
});

describe("outcomeOf", () => {
  it("takes a recorded callback answer over execution", async () => {
    const ex = executor({ ok: true, outputs: { x: "exec" } });
    const callbacks = { [KEY]: [{ inputs: { mode: "fast" }, outputs: { x: "cb" } }] };
    const scoped = { inputs: { mode: { kind: "value" as const, v: "fast" } } };
    expect(await outcomeOf("detect", {}, scoped, args({ callbacks, executor: ex }))).toEqual({
      ok: true,
      outputs: { x: "cb" },
    });
    expect(ex.executeJob).not.toHaveBeenCalled();
  });

  it("refuses a callback key that answers nothing for this invocation", async () => {
    const callbacks = { [KEY]: [{ inputs: { mode: "slow" }, outputs: {} }] };
    expect(await outcomeOf("detect", {}, {}, args({ callbacks }))).toEqual({
      ok: false,
      reason: "no callback entry matches 'o/r/.github/workflows/w.yml:detect' with inputs {}",
    });
  });

  it("aborts on two callback answers for one invocation", async () => {
    const callbacks = { [KEY]: [{ inputs: {}, outputs: {} }, { inputs: {}, outputs: {} }] };
    await expect(outcomeOf("detect", {}, {}, args({ callbacks }))).rejects.toThrow(
      "2 callback entries match 'o/r/.github/workflows/w.yml:detect' with inputs {}",
    );
  });

  it("executes a steps job, and has nothing without an executor", async () => {
    const ex = executor({ ok: true, outputs: { x: "y" } });
    const job = { steps: [] };
    expect(await outcomeOf("detect", job, {}, args({ executor: ex }))).toEqual({ ok: true, outputs: { x: "y" } });
    expect(ex.executeJob).toHaveBeenCalledWith("detect", job, { jobs: {} }, {});
    expect(await outcomeOf("detect", job, {}, args())).toBeNull();
  });

  it("names the job whose execution failed", async () => {
    expect(await outcomeOf("detect", {}, {}, args({ executor: executor({ ok: false, reason: "boom" }) }))).toEqual({
      ok: false,
      reason: "executing 'detect' failed: boom",
    });
  });

  it("settles a reusable call from its callee, with or without an executor", async () => {
    const ex = executor({ ok: true, outputs: {} });
    const job = { uses: "./.github/workflows/sub.yml" };
    expect(await outcomeOf("detect", job, {}, args())).toEqual({
      ok: false,
      reason: "executing 'detect' failed: cannot fetch ./.github/workflows/sub.yml",
    });
    const reader = { fetchWorkflow: async () => "on: {workflow_call: {outputs: {x: {value: lit}}}}", resolveRef: async () => null };
    expect(await outcomeOf("detect", job, {}, args({ reader, executor: ex }))).toEqual({ ok: true, outputs: { x: "lit" } });
    expect(ex.executeJob).not.toHaveBeenCalled();
  });
});
