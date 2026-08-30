import type { WorkflowSource } from 'willfire';

/**
 * The commits a prediction was read from, as `owner/repo@ref -> sha`.
 *
 * A `uses:` tag can name a different program an hour later, so "willfire said
 * these checks" is only reconcilable against a run if it also says which
 * commits it read to say it. Logging it is what makes a red gate answerable
 * after the fact, when the tag has already moved again.
 */
export function formatSources(sources: ReadonlyArray<WorkflowSource>): string {
  return sources.map((s) => `${s.owner}/${s.repo}@${s.ref} -> ${s.sha}`).join(', ');
}
