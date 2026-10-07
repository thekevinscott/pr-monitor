import { expect, test } from "vitest";
import config from "../e2e/vitest.config.mts";

test("the e2e budget accommodates the executor case on a busy host", () => {
  // The full case took 810.66s locally on 2026-10-06 (#165).
  expect(config.test?.testTimeout).toBeGreaterThanOrEqual(900_000);
});
