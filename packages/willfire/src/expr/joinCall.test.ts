import { describe, expect, it } from "vitest";
import { joinCall } from "./joinCall.js";

const UNKNOWN = { kind: "unknown" } as const;

describe("joinCall", () => {
  it("joins an array with the separator given", () => {
    expect(joinCall([{ kind: "json", v: ["a", "b"] }, { kind: "value", v: "|" }])).toEqual({
      kind: "value",
      v: "a|b",
    });
  });

  it("joins with a comma when no separator is given", () => {
    expect(joinCall([{ kind: "json", v: ["a", 1, true] }])).toEqual({
      kind: "value",
      v: "a,1,true",
    });
  });

  it("joins an empty array to the empty string", () => {
    expect(joinCall([{ kind: "json", v: [] }])).toEqual({ kind: "value", v: "" });
  });

  it("returns a plain value as its own text", () => {
    expect(joinCall([{ kind: "value", v: "x" }, { kind: "value", v: "|" }])).toEqual({
      kind: "value",
      v: "x",
    });
  });

  it("is unknown over an element that is not a primitive", () => {
    expect(joinCall([{ kind: "json", v: [["a"]] }])).toEqual(UNKNOWN);
  });

  it("is unknown over an object", () => {
    expect(joinCall([{ kind: "json", v: { a: "b" } }])).toEqual(UNKNOWN);
  });

  it("is unknown over an unknown array", () => {
    expect(joinCall([UNKNOWN])).toEqual(UNKNOWN);
  });

  it("is unknown with an unknown separator", () => {
    expect(joinCall([{ kind: "json", v: ["a"] }, UNKNOWN])).toEqual(UNKNOWN);
  });

  it("is unknown with no arguments", () => {
    expect(joinCall([])).toEqual(UNKNOWN);
  });
});
