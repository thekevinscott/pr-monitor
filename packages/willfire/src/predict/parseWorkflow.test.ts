import { describe, expect, it } from "vitest";
import { parseWorkflow } from "./parseWorkflow.js";

describe("parseWorkflow", () => {
  it("returns null for an absent file", () => {
    expect(parseWorkflow(null)).toBeNull();
  });

  it("parses a workflow file", () => {
    expect(parseWorkflow("on: pull_request\njobs: {}\n")).toEqual({
      on: "pull_request",
      jobs: {},
    });
  });

  it("throws on invalid YAML", () => {
    expect(() => parseWorkflow("on: [")).toThrow();
  });
});
