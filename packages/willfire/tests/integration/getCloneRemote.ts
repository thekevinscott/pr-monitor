import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { WorkflowSource } from "willfire";

// A bundle runs to tens of MB and every committed byte lands in the tarball a
// live prediction of this repo downloads (#166), so case dirs share their
// pull request's bundle rather than copying it.
export const bundleDirs = (dir: string): string[] => [dir, dirname(dir)];

// A live clone sees refs pushed after the recording, so replay serves the
// recorded bundle and refuses to fall back to the network.
export const getCloneRemote =
  (dir: string) =>
  (source: WorkflowSource): string => {
    const name = `clone-${source.owner}-${source.repo}.bundle`;
    const bundle = bundleDirs(dir)
      .map((d) => join(d, name))
      .find((p) => existsSync(p));
    if (bundle === undefined) {
      throw new Error(`unrecorded clone of ${source.owner}/${source.repo}@${source.sha}: no ${name} in ${dir}`);
    }
    return bundle;
  };
