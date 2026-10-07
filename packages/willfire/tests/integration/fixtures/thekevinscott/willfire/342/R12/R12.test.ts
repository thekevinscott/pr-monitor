import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { willfire } from "willfire";
import { getCalls } from "../../../../../getCalls.js";
import { replayClient } from "../../../../../mocks/replayClient.js";

// Run 36417461106: the workflow ran and failed with zero jobs, so the verdict
// is a run, never no-dispatch, and neither job gets an entry.
test("R12 collapses a workflow with an over-deep reusable chain to a run with no jobs", async () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const { entries } = await willfire(replayClient(getCalls(dir)), "thekevinscott/willfire", 342);
  const mixed = entries
    .filter((entry) => entry.workflow === ".github/workflows/probe-r12d-mixed.yml")
    .map(({ job, status }) => ({ job, status }));
  expect(mixed).toEqual([{ job: "*", status: "run" }]);
}, 300_000);
