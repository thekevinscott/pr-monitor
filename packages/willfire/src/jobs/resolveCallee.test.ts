import { describe, expect, it, vi } from "vitest";
import { resolveCallee } from "./resolveCallee.js";
import type { JobSite, WorkflowReader, WorkflowSource } from "../types.js";

vi.mock(
  "../uses/parseUses.js",
  async () => await vi.importActual<typeof import("../uses/parseUses.js")>("../uses/parseUses.js"),
);

const SHA = "a".repeat(40);
const REMOTE_SHA = "b".repeat(40);
const SOURCE: WorkflowSource = { owner: "o", repo: "r", ref: SHA, sha: SHA };
const SITE: JobSite = { path: ".github/workflows/caller.yml", source: SOURCE };

const reader = (
  files: Record<string, string | null>,
  resolveRef: WorkflowReader["resolveRef"] = async () => REMOTE_SHA,
): WorkflowReader & { fetched: [string, WorkflowSource][] } => {
  const fetched: [string, WorkflowSource][] = [];
  return {
    fetched,
    resolveRef,
    fetchWorkflow: async (path, source) => {
      fetched.push([path, source]);
      return files[path] ?? null;
    },
  };
};

describe("resolveCallee", () => {
  it("reads a local call from the caller's own pinned source", async () => {
    const r = reader({ ".github/workflows/sub.yml": "jobs: {a: {}}" });
    expect(await resolveCallee("./.github/workflows/sub.yml", SITE, r)).toEqual({
      ok: true,
      wf: { jobs: { a: {} } },
      site: { path: ".github/workflows/sub.yml", source: SOURCE },
    });
  });

  it("resolves a cross-repo tag before reading, so the file and the commit agree", async () => {
    const r = reader({ ".github/workflows/b.yml": "jobs: {}" });
    const res = await resolveCallee("x/y/.github/workflows/b.yml@v0", SITE, r);
    const source = { owner: "x", repo: "y", ref: "v0", sha: REMOTE_SHA };
    expect(res).toEqual({ ok: true, wf: { jobs: {} }, site: { path: ".github/workflows/b.yml", source } });
    expect(r.fetched).toEqual([[".github/workflows/b.yml", source]]);
  });

  it("takes a full commit id as already resolved", async () => {
    const resolveRef = vi.fn(async () => null);
    const r = reader({ ".github/workflows/b.yml": "jobs: {}" }, resolveRef);
    const res = await resolveCallee(`x/y/.github/workflows/b.yml@${REMOTE_SHA}`, SITE, r);
    expect(res.ok).toBe(true);
    expect(resolveRef).not.toHaveBeenCalled();
  });

  it("names why a callee cannot be had", async () => {
    expect(await resolveCallee("not a ref", SITE, reader({}))).toEqual({
      ok: false,
      reason: "unresolvable reusable reference: not a ref",
    });
    expect(await resolveCallee("x/y/.github/workflows/b.yml@v0", SITE, reader({}, async () => null))).toEqual({
      ok: false,
      reason: "cannot resolve ref for x/y/.github/workflows/b.yml@v0",
    });
    expect(await resolveCallee("./.github/workflows/sub.yml", SITE, reader({}))).toEqual({
      ok: false,
      reason: "cannot fetch ./.github/workflows/sub.yml",
    });
    expect(await resolveCallee("./.github/workflows/sub.yml", SITE, reader({ ".github/workflows/sub.yml": "" }))).toEqual({
      ok: false,
      reason: "cannot resolve ./.github/workflows/sub.yml",
    });
    const bad = await resolveCallee("./.github/workflows/sub.yml", SITE, reader({ ".github/workflows/sub.yml": "a: [" }));
    expect(bad.ok).toBe(false);
    expect(bad.ok ? "" : bad.reason).toMatch(/^YAML parse error in \.\/\.github\/workflows\/sub\.yml: /);
  });
});
