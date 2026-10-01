import type { SourceRef } from "../types.js";

/** Identity of a source as written, before resolution. */
export function sourceKey(s: SourceRef): string {
  return `${s.owner}/${s.repo}@${s.ref}`;
}
