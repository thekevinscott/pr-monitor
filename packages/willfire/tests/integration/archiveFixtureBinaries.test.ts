import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";

test("source archives omit recorded tarball binaries but retain fixture metadata", () => {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  const fixture = "packages/willfire/tests/integration/fixtures/thekevinscott/pr-monitor/98";
  const archive = execFileSync(
    "git",
    ["archive", "--format=tar", "HEAD", "--", `${fixture}/fixture.json`, `${fixture}/tarball-0.bin`],
    { cwd: root },
  );
  const files = execFileSync("tar", ["-tf", "-"], {
    input: archive,
    encoding: "utf8",
  }).split("\n");

  expect(files).toContain(`${fixture}/fixture.json`);
  expect(files).not.toContain(`${fixture}/tarball-0.bin`);
});
