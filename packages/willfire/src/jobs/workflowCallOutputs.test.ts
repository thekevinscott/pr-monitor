import { describe, expect, it } from "vitest";
import { workflowCallOutputs } from "./workflowCallOutputs.js";

describe("workflowCallOutputs", () => {
  it("reads each declared output's raw value", () => {
    expect(
      workflowCallOutputs({
        on: { workflow_call: { outputs: { a: { value: "${{ jobs.x.outputs.a }}" }, b: { value: 3 } } } },
      }),
    ).toEqual({ a: "${{ jobs.x.outputs.a }}", b: "3" });
  });

  it("reads the YAML 1.1 `true` key a bare `on:` parses to", () => {
    expect(workflowCallOutputs({ true: { workflow_call: { outputs: { a: { value: "v" } } } } })).toEqual({
      a: "v",
    });
  });

  it("reads an output with no value, or a null declaration, as empty", () => {
    expect(
      workflowCallOutputs({ on: { workflow_call: { outputs: { a: { description: "d" }, b: null, c: { value: null } } } } }),
    ).toEqual({ a: "", b: "", c: "" });
  });

  it("finds nothing when the callee declares no outputs", () => {
    expect(workflowCallOutputs({})).toEqual({});
    expect(workflowCallOutputs({ on: { workflow_call: null } })).toEqual({});
    expect(workflowCallOutputs({ on: { workflow_call: { outputs: null } } })).toEqual({});
    expect(workflowCallOutputs({ on: { workflow_call: { outputs: "x" } } })).toEqual({});
  });
});
