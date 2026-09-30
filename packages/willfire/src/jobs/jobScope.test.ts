import { describe, expect, it } from "vitest";
import type { Scope } from "../expr/val.js";
import type { Workflow } from "../types.js";
import { jobScope } from "./jobScope.js";

describe("jobScope", () => {
  const scope: Scope = { vars: { A: "1" }, varsComplete: true };

  it("keeps the prediction's scope for a job with no environment", () => {
    expect(jobScope({} as Workflow, scope)).toBe(scope);
  });

  it("drops listing completeness for a job that declares an environment", () => {
    expect(jobScope({ environment: "prod" } as Workflow, scope)).toEqual({
      vars: { A: "1" },
      varsComplete: false,
    });
  });
});
