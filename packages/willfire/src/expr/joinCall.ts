import { UNKNOWN, type Val } from "./val.js";

/**
 * `join(array, sep)`, separator `,` by default. A plain value is its own
 * text, as on the runner. An element that is itself an array, an object or
 * null is not modelled.
 */
export function joinCall(args: Val[]): Val {
  const [hay, sep] = args;
  if (hay === undefined || (sep !== undefined && sep.kind !== "value")) {
    return UNKNOWN;
  }
  if (hay.kind === "value") {
    return { kind: "value", v: String(hay.v) };
  }
  if (hay.kind !== "json" || !Array.isArray(hay.v)) {
    return UNKNOWN;
  }
  const parts: string[] = [];
  for (const el of hay.v) {
    if (typeof el !== "string" && typeof el !== "number" && typeof el !== "boolean") {
      return UNKNOWN;
    }
    parts.push(String(el));
  }
  return { kind: "value", v: parts.join(sep === undefined ? "," : String(sep.v)) };
}
