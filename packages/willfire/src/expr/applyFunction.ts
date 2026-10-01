import { asBool } from "./asBool.js";
import { containsCall } from "./containsCall.js";
import { formatCall } from "./formatCall.js";
import { fromJson } from "./fromJson.js";
import { joinCall } from "./joinCall.js";
import { UNKNOWN, type Scope, type Val } from "./val.js";

/**
 * `always()` is true by definition and `cancelled()` is false by the same
 * token: willfire answers for a dispatch that happens, never for a cancelled
 * one. `success()` and `failure()` read the needs state the scope carries.
 * `fromJSON` is what a dynamic matrix axis is built out of, and `format` is
 * what a conditional `name:` suffix is built out of, as `join` is for a
 * label list (probe #383). Every function not
 * modelled here is unknown.
 */
export function applyFunction(name: string, args: Val[], scope: Scope): Val {
  if (name === "always") {
    return { kind: "value", v: true };
  }
  if ((name === "success" || name === "failure" || name === "cancelled") && args.length === 0) {
    if (name === "cancelled" || scope.needsSettled === "some-skipped") {
      return asBool(false);
    }
    if (scope.needsSettled === "all-run") {
      return asBool(name === "success");
    }
    return UNKNOWN;
  }
  if (name === "fromjson" && args.length === 1) {
    return fromJson(args[0]);
  }
  if (name === "format") {
    return formatCall(args);
  }
  if (name === "join" && (args.length === 1 || args.length === 2)) {
    return joinCall(args);
  }
  if (name === "contains" && args.length === 2) {
    return containsCall(args[0], args[1]);
  }
  if ((name === "startswith" || name === "endswith") && args.length === 2) {
    const [s, part] = args;
    if (typeof s.v !== "string" || typeof part.v !== "string") {
      return UNKNOWN;
    }
    return asBool(name === "startswith" ? s.v.startsWith(part.v) : s.v.endsWith(part.v));
  }
  return UNKNOWN;
}
