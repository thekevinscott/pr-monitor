import type { YamlValue } from "../yamlValue.js";

/**
 * How a single matrix value is rendered inside a check name.
 *
 * Probe-verified: object values are flattened to their own values, so
 * `cfg: {os: linux, arch: x64}` renders as `linux, x64` — the check is
 * `m-object (linux, x64)`. A list flattens the same way.
 */
export function formatMatrixValue(v: YamlValue | undefined): string {
  if (v === null || v === undefined) {
    return "";
  }
  if (typeof v === "object") {
    return Object.values(v).map(formatMatrixValue).join(", ");
  }
  return String(v);
}
