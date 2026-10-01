import { describe, expect, it } from "vitest";
import { sourceKey } from "./sourceKey.js";
import type { WorkflowSource } from "../types.js";

describe("sourceKey", () => {
  it("keys a source by owner, repo and the ref as written", () => {
    expect(sourceKey({ owner: "o", repo: "r", ref: "v1" })).toBe("o/r@v1");
  });

  it("leaves a resolved sha out of the key", () => {
    const resolved: WorkflowSource = { owner: "o", repo: "r", ref: "v1", sha: "c".repeat(40) };
    expect(sourceKey(resolved)).toBe("o/r@v1");
  });
});
