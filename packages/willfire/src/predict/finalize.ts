import type { DraftEntry, DraftWorkflowEntry, Entry } from "../types.js";

export function finalize(e: DraftEntry): Entry {
  const isWorkflowDraft = (d: DraftEntry): d is DraftWorkflowEntry => d.job === "*";
  return isWorkflowDraft(e) ? { ...e, checkName: null } : { ...e, checkName: e.checkName ?? null };
}
