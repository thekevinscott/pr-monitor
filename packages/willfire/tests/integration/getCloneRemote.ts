import { existsSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowSource } from "willfire";

// A live clone sees refs pushed after the recording, so replay serves the
// recorded bundle and refuses to fall back to the network.
export const getCloneRemote =
  (dir: string) =>
  (source: WorkflowSource): string => {
    const bundle = join(dir, `clone-${source.owner}-${source.repo}.bundle`);
    if (!existsSync(bundle)) {
      throw new Error(`unrecorded clone of ${source.owner}/${source.repo}@${source.sha}: no ${bundle}`);
    }
    return bundle;
  };
