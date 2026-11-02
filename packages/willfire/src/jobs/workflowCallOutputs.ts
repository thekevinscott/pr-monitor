import type { Workflow } from "../types.js";
import type { YamlMap, YamlValue } from "../yamlValue.js";

interface OnBlock {
  workflow_call?: { outputs?: YamlValue } | null;
}

/** Each `on.workflow_call.outputs.<name>.value`, raw, tolerating the YAML 1.1 `on` -> true key. */
export function workflowCallOutputs(wf: Workflow): Record<string, string> {
  const on = (wf["on"] ?? wf["true"]) as OnBlock | undefined;
  const outputs = on?.["workflow_call"]?.["outputs"];
  const out: Record<string, string> = {};
  if (outputs !== null && typeof outputs === "object") {
    for (const [name, decl] of Object.entries(outputs as YamlMap)) {
      const value = (decl as YamlMap | null)?.["value"];
      out[name] = value === undefined || value === null ? "" : String(value);
    }
  }
  return out;
}
