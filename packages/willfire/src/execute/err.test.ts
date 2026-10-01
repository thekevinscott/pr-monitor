import { describe, expect, it } from "vitest";
import { err } from "./err.js";

describe("err", () => {
  it("wraps a reason as a failed Res", () => {
    expect(err("boom")).toEqual({ ok: false, reason: "boom" });
  });

  it("keeps a multi-line reason verbatim", () => {
    expect(err("parse error:\n  at line 2\n")).toEqual({
      ok: false,
      reason: "parse error:\n  at line 2\n",
    });
  });
});
