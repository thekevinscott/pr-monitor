import type { Entry, JobEntry } from "../types.js";

/** Narrow to the job-level variant without inspecting the sentinel. */
export function isJobEntry(e: Entry): e is JobEntry {
  return e.job !== "*";
}
