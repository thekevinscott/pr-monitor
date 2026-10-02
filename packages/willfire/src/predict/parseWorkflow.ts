import { parse as parseYaml } from "yaml";
import type { Workflow } from "../types.js";

/** Parse a fetched workflow file; an absent file is null. Throws on invalid YAML. */
export function parseWorkflow(content: string | null): Workflow | null {
  return content === null ? null : parseYaml(content);
}
