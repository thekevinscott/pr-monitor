import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { willfire } from "willfire";
import { getCalls } from "../../../../../getCalls.js";
import { replayClient } from "../../../../../mocks/replayClient.js";

test("D19 runs a branches: [main] workflow on a stacked-mode hop whose stack targets main", async () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const { entries } = await willfire(replayClient(getCalls(dir)), "thekevinscott/pr-monitor", 245);
  expect(entries.filter((e) => e.workflow === ".github/workflows/pr-monitor.yml")).toEqual([
    {
      workflow: ".github/workflows/pr-monitor.yml",
      job: "CI Gate",
      checkName: "CI Gate",
      status: "run",
      reason: "trigger matched",
    },
  ]);
}, 300_000);
