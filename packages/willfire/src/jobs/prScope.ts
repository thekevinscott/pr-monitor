import type { Scope } from "../expr/val.js";

/**
 * `predict` only ever answers for a pull request, so `event_name` is fixed —
 * which is what lets a `github.event_name == 'pull_request'` guard resolve
 * instead of hanging the job on an unknown. Anything the caller states wins.
 */
export function prScope(scope: Scope): Scope {
  return { ...scope, github: { event_name: "pull_request", ...scope.github } };
}
