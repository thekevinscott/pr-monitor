import { describe, expect, it } from "vitest";
import { neededJobIds } from "./neededJobIds.js";

describe("neededJobIds", () => {
  it("collects the jobs whose outputs some sibling reads", () => {
    const jobs = {
      detect: { outputs: { langs: "x" } },
      test: { if: "${{ fromJSON(needs.detect.outputs.langs) }}" },
      lint: { needs: "detect" },
    };
    expect(neededJobIds(jobs)).toEqual(new Set(["detect"]));
  });

  it("matches any read site in the serialized job, spacing included", () => {
    const jobs = { a: { env: { X: "${{ needs . plan . outputs.m }}" } } };
    expect(neededJobIds(jobs)).toEqual(new Set(["plan"]));
  });

  it("reads a hyphenated job id whole", () => {
    const jobs = { a: { if: "${{ needs.build-linux.outputs.ok }}" } };
    expect(neededJobIds(jobs)).toEqual(new Set(["build-linux"]));
  });

  it("ignores a read of a needed job's result rather than its outputs", () => {
    expect(neededJobIds({ a: { if: "${{ needs.b.result == 'success' }}" } })).toEqual(new Set());
  });

  it("ignores needs without an outputs read, and tolerates a null job", () => {
    expect(neededJobIds({ a: { needs: ["b"] }, b: null as never })).toEqual(new Set());
  });
});
