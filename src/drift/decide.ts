import type { TagRelation } from '../github';

export interface DriftFacts {
  tag: string;
  branch: string;
  relation: TagRelation;
  aheadBy: number;
  limit: number;
}

export interface Decision {
  exitCode: number;
  /** Workflow commands, written verbatim by the caller. */
  lines: string[];
}

const alarm = (message: string): Decision => ({ exitCode: 1, lines: [`::error::${message}`] });

const clear = (message: string): Decision => ({ exitCode: 0, lines: [`::notice::${message}`] });

// Distance alone. A branch red for longer than the limit is itself worth alarming
// about, so there is no false alarm to suppress.
export function decide({ tag, branch, relation, aheadBy, limit }: DriftFacts): Decision {
  if (relation === 'missing') {
    return alarm(`${tag} does not exist; every consumer pinned to it is broken`);
  }

  if (relation === 'diverged') {
    return alarm(`${tag} points off ${branch}; the gap is not a lag`);
  }

  if (aheadBy > limit) {
    return alarm(
      `${tag} lags ${branch} by ${aheadBy}, past the limit of ${limit}; the event-driven promoter has stopped advancing it`,
    );
  }

  return clear(`${tag} lags ${branch} by ${aheadBy}, within the limit of ${limit}`);
}
