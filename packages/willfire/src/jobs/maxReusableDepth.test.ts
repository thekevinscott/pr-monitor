import { expect, it } from "vitest";
import { MAX_REUSABLE_DEPTH } from "./maxReusableDepth.js";

it("allows ten reusable levels below the caller, as measured on GitHub.com", () => {
  expect(MAX_REUSABLE_DEPTH).toBe(10);
});
