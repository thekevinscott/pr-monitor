import { describe, expect, it } from "vitest";
import { decidedInputs } from "./decidedInputs.js";

describe("decidedInputs", () => {
  it("keeps decided values as strings and drops the undecided", () => {
    expect(
      decidedInputs({
        inputs: {
          a: { kind: "value", v: "x" },
          n: { kind: "value", v: 4 },
          b: { kind: "value", v: true },
          u: { kind: "unknown" },
          t: { kind: "truthy" },
        },
      }),
    ).toEqual({ a: "x", n: "4", b: "true" });
  });

  it("keeps a decided empty string, which is what an absent input reads as", () => {
    expect(decidedInputs({ inputs: { a: { kind: "value", v: "" } } })).toEqual({ a: "" });
  });

  it("answers empty for a scope with no inputs at all", () => {
    expect(decidedInputs({})).toEqual({});
  });
});
