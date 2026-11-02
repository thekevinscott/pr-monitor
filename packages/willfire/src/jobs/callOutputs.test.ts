import { describe, expect, it, vi } from "vitest";
import { callOutputs } from "./callOutputs.js";
import type { ExpandJobsArgs } from "./expandJobs.js";
import type { JobExecutor } from "../execute/types.js";
import type { Scope } from "../expr/val.js";
import type { JobSite, WorkflowSource } from "../types.js";
import type { YamlMap } from "../yamlValue.js";

vi.mock(
  "./calleeInputs.js",
  async () => await vi.importActual<typeof import("./calleeInputs.js")>("./calleeInputs.js"),
);
vi.mock(
  "./resolveCallee.js",
  async () => await vi.importActual<typeof import("./resolveCallee.js")>("./resolveCallee.js"),
);
vi.mock(
  "./settleScope.js",
  async () => await vi.importActual<typeof import("./settleScope.js")>("./settleScope.js"),
);
vi.mock(
  "./workflowCallOutputs.js",
  async () =>
    await vi.importActual<typeof import("./workflowCallOutputs.js")>("./workflowCallOutputs.js"),
);

const SHA = "a".repeat(40);
const SOURCE: WorkflowSource = { owner: "o", repo: "r", ref: SHA, sha: SHA };
const SITE: JobSite = { path: ".github/workflows/caller.yml", source: SOURCE };
const USES = "./.github/workflows/sub.yml";

const callee = (outputs: Record<string, string>, jobs: YamlMap, inputs: YamlMap = {}) =>
  JSON.stringify({
    on: { workflow_call: { inputs, outputs: Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, { value: v }])) } },
    jobs,
  });

const recording = (byJob: Record<string, Record<string, string> | string>) => {
  const executed: [string, Scope][] = [];
  const executor: JobExecutor = {
    executeJob: async (jobId, _job, _wf, scope) => {
      executed.push([jobId, scope]);
      const out = byJob[jobId];
      return typeof out === "string" ? { ok: false, reason: out } : { ok: true, outputs: out ?? {} };
    },
  };
  return { executed, executor };
};

const args = (file: string | null, extra: Partial<ExpandJobsArgs> = {}): ExpandJobsArgs => ({
  wf: { jobs: {} },
  reader: {
    fetchWorkflow: async (path) => (path === ".github/workflows/sub.yml" ? file : null),
    resolveRef: async () => null,
  },
  site: SITE,
  ...extra,
});

describe("callOutputs", () => {
  it("renders each output from the callee jobs it reads, executing only those", async () => {
    const { executed, executor } = recording({ inner: { x: "1" } });
    const file = callee(
      { x: "${{ jobs.inner.outputs.x }}", both: "v-${{ jobs.inner.outputs.x }}", lit: "plain" },
      { inner: { steps: [] }, other: { steps: [] } },
    );
    expect(await callOutputs({ uses: USES }, {}, args(file, { executor }))).toEqual({
      ok: true,
      outputs: { x: "1", both: "v-1", lit: "plain" },
    });
    expect(executed.map(([id]) => id)).toEqual(["inner"]);
  });

  it("runs the callee under the inputs the call passed and the caller's github and vars", async () => {
    const { executed, executor } = recording({ inner: { x: "1" } });
    const file = callee({ x: "${{ jobs.inner.outputs.x }}" }, { inner: { if: "inputs.mode == 'fast'", steps: [] } }, {
      mode: { type: "string" },
    });
    const scope: Scope = {
      github: { event_name: "pull_request" },
      vars: { V: "1" },
      varsComplete: true,
      needs: { up: { outputs: { m: "fast" } } },
    };
    const res = await callOutputs({ uses: USES, with: { mode: "${{ needs.up.outputs.m }}" } }, scope, args(file, { executor }));
    expect(res).toEqual({ ok: true, outputs: { x: "1" } });
    expect(executed[0][1]).toMatchObject({
      inputs: { mode: { kind: "value", v: "fast" } },
      github: { event_name: "pull_request" },
      vars: { V: "1" },
      varsComplete: true,
    });
    expect(executed[0][1].needs).toBeUndefined();
  });

  it("leaves an output undecided when its job did not settle", async () => {
    const { executor } = recording({ inner: "boom" });
    const file = callee({ x: "${{ jobs.inner.outputs.x }}" }, { inner: { steps: [] } });
    expect(await callOutputs({ uses: USES }, {}, args(file, { executor }))).toEqual({
      ok: false,
      reason: `output 'x' of ${USES} is undecided`,
    });
  });

  it("passes on why the callee cannot be had", async () => {
    expect(await callOutputs({ uses: USES }, {}, args(null))).toEqual({ ok: false, reason: `cannot fetch ${USES}` });
  });

  it("refuses a matrixed call, whose outputs are whichever combination wrote last", async () => {
    const file = callee({}, {});
    expect(await callOutputs({ uses: USES, strategy: { matrix: { a: [1] } } }, {}, args(file))).toEqual({
      ok: false,
      reason: `outputs of a matrixed call to ${USES}`,
    });
  });

  it("stops at the reusable depth limit", async () => {
    const file = callee({ x: "plain" }, {});
    expect(await callOutputs({ uses: USES }, {}, args(file, { depth: 9 }))).toEqual({ ok: true, outputs: { x: "plain" } });
    expect(await callOutputs({ uses: USES }, {}, args(file, { depth: 10 }))).toEqual({
      ok: false,
      reason: `reusable workflow nested deeper than 10 levels at ${USES}`,
    });
  });

  it("counts the callee's own calls a level deeper", async () => {
    const files: Record<string, string> = {
      ".github/workflows/sub.yml": callee({ x: "${{ jobs.mid.outputs.y }}" }, { mid: { uses: "./.github/workflows/leaf.yml" } }),
      ".github/workflows/leaf.yml": callee({ y: "plain" }, {}),
    };
    const reader = { fetchWorkflow: async (path: string) => files[path] ?? null, resolveRef: async () => null };
    expect(await callOutputs({ uses: USES }, {}, { ...args(null), reader, depth: 8 })).toEqual({
      ok: true,
      outputs: { x: "plain" },
    });
    expect(await callOutputs({ uses: USES }, {}, { ...args(null), reader, depth: 9 })).toEqual({
      ok: false,
      reason: `output 'x' of ${USES} is undecided`,
    });
  });

  it("reads the callee's jobs relative to the callee, a level deeper", async () => {
    const { executed, executor } = recording({ leaf: { y: "2" } });
    const files: Record<string, string> = {
      ".github/workflows/sub.yml": callee({ x: "${{ jobs.mid.outputs.y }}" }, { mid: { uses: "./.github/workflows/leaf.yml" } }),
      ".github/workflows/leaf.yml": callee({ y: "${{ jobs.leaf.outputs.y }}" }, { leaf: { steps: [] } }),
    };
    const res = await callOutputs({ uses: USES }, {}, {
      ...args(null, { executor }),
      reader: { fetchWorkflow: async (path) => files[path] ?? null, resolveRef: async () => null },
    });
    expect(res).toEqual({ ok: true, outputs: { x: "2" } });
    expect(executed.map(([id]) => id)).toEqual(["leaf"]);
  });
});
