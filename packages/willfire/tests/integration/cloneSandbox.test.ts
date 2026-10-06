import { expect, test } from "vitest";
import { makeLiveExecutor } from "../../src/predict/makeLiveExecutor.js";
import type { RunSpec } from "../../src/execute/types.js";
import type { WorkflowSource } from "../../src/types.js";

const source: WorkflowSource = {
  owner: "o",
  repo: "r",
  ref: "a".repeat(40),
  sha: "a".repeat(40),
};

test("a history checkout clones through the sandbox runner with only its scratch directory mounted", async () => {
  const specs: RunSpec[] = [];
  const executor = makeLiveExecutor(
    { downloadTarball: async () => new ArrayBuffer(0) },
    source,
    async () => null,
    {
      token: "test-token",
      remoteUrl: () => "file:///unreachable",
      runCommand: async (spec) => {
        specs.push(spec);
        return { code: 0, stdout: "", stderr: "" };
      },
    },
  );

  try {
    expect(
      await executor.executeJob(
        "detect",
        { steps: [{ uses: "actions/checkout@v6", with: { "fetch-depth": 0 } }] },
        {},
        { github: {} },
      ),
    ).toEqual({ ok: true, outputs: {} });
    expect(specs).toHaveLength(1);
    const [clone] = specs;
    expect(clone.script).toContain("git");
    expect(clone.mounts).toEqual([{ path: clone.cwd, writable: true }]);
  } finally {
    await executor.cleanup?.();
  }
});
