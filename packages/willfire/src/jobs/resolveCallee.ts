import { parse as parseYaml } from "yaml";
import { parseUses } from "../uses/parseUses.js";
import type { JobSite, Workflow, WorkflowReader, WorkflowSource } from "../types.js";

export type Callee = { ok: true; wf: Workflow; site: JobSite } | { ok: false; reason: string };

/**
 * A local `./` call stays on the caller's source, already pinned to a commit.
 * A cross-repo one arrives as whatever the `uses:` string spelled — `@v0` — and
 * is resolved first, so the file read and the commit predicted are one.
 */
export async function resolveCallee(uses: string, site: JobSite, reader: WorkflowReader): Promise<Callee> {
  const target = parseUses(uses);
  if (target === null) {
    return { ok: false, reason: `unresolvable reusable reference: ${uses}` };
  }
  let resolved: WorkflowSource | null = site.source;
  if (target.source !== null) {
    const { ref } = target.source;
    const sha = /^[0-9a-f]{40}$/i.test(ref) ? ref : await reader.resolveRef(target.source);
    resolved = sha === null ? null : { ...target.source, sha };
  }
  if (resolved === null) {
    return { ok: false, reason: `cannot resolve ref for ${uses}` };
  }
  const content = await reader.fetchWorkflow(target.path, resolved);
  if (content === null) {
    return { ok: false, reason: `cannot fetch ${uses}` };
  }
  let wf: Workflow | null;
  try {
    wf = parseYaml(content);
  } catch (e) {
    return { ok: false, reason: `YAML parse error in ${uses}: ${e}` };
  }
  if (wf === null) {
    return { ok: false, reason: `cannot resolve ${uses}` };
  }
  return { ok: true, wf, site: { path: target.path, source: resolved } };
}
