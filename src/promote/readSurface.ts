import { isPassingConclusion } from '../checks';
import type { WorkflowJobSummary } from '../types';

export type SurfaceState = 'unreadable' | 'empty' | 'running' | 'failing' | 'green';

export interface Surface {
  state: SurfaceState;
  names: string[];
}

export interface SurfaceFacts {
  selfWorkflowPath: string | null;
  jobs: ReadonlyArray<WorkflowJobSummary>;
}

const surface = (state: SurfaceState, blame: ReadonlyArray<WorkflowJobSummary> = []): Surface => ({
  state,
  names: blame.map((job) => job.name),
});

// Fails closed: `unreadable` and `empty` are not evidence the commit is good.
export function readSurface({ selfWorkflowPath, jobs }: SurfaceFacts): Surface {
  if (selfWorkflowPath === null) return surface('unreadable');

  // A caller's own checks land on the commit it is judging; counting them waits on itself.
  const observed = jobs.filter((job) => job.workflowPath !== selfWorkflowPath);
  if (observed.length === 0) return surface('empty');

  const running = observed.filter((job) => job.status !== 'completed');
  if (running.length > 0) return surface('running', running);

  const failing = observed.filter((job) => !isPassingConclusion(job.conclusion));
  if (failing.length > 0) return surface('failing', failing);

  return surface('green');
}
