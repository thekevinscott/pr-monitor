import type { WorkflowSource } from 'willfire';

export function formatSources(sources: ReadonlyArray<WorkflowSource>): string {
  return sources.map((s) => `${s.owner}/${s.repo}@${s.ref} -> ${s.sha}`).join(', ');
}
