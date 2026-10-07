import { cachedByKey } from "./cachedByKey.js";
import { cloneAt } from "./cloneAt.js";
import type { WorkflowSource } from "../types.js";
import type { RunCommand, TreeSource } from "./types.js";

/**
 * Materialize repo trees by full clone. Auth travels as a per-invocation
 * `http.extraheader`, never in the URL or persisted git config.
 */
export function makeCloneProvider(
  runCommand: RunCommand,
  token: string | null,
  opts: { remoteUrl?: (source: WorkflowSource) => string } = {},
): TreeSource {
  const remoteUrl =
    opts.remoteUrl ?? ((s: WorkflowSource) => `https://github.com/${s.owner}/${s.repo}.git`);
  return cachedByKey((source) => cloneAt(source, remoteUrl(source), token, runCommand));
}
