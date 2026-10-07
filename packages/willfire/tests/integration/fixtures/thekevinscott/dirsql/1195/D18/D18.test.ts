import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { willfire } from "willfire";
import { getCalls } from "../../../../../getCalls.js";
import { replayClient } from "../../../../../mocks/replayClient.js";

test("D18 declines a branches: [main] workflow on a PR stacked on a feature branch", async () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const { entries } = await willfire(replayClient(getCalls(dir)), "thekevinscott/dirsql", 1195);
  expect(entries.filter((e) => e.workflow === ".github/workflows/probe-stack-branch-366.yml")).toEqual([
    {
      workflow: ".github/workflows/probe-stack-branch-366.yml",
      job: "*",
      status: "no-dispatch",
      reason: "base branch 'probe/366-stack-base' not in branches",
      checkName: null,
    },
  ]);
}, 300_000);
