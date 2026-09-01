import { decide as decidePromotion } from '../promote/decide';
import type { Decision } from '../promote/decide';
import type { GreenCommit } from './findGreenHead';

export interface BackstopFacts {
  tag: string;
  branch: string;
  /** Commits the walk actually looked at. */
  examined: number;
  maxDrift: number;
  selfWorkflowPath: string | null;
  green: GreenCommit | null;
}

// The move is promote/decide's answer unmodified; this adds only the drift alarm.
// Healing quietly would hide the dead event chain, so an over-drifted tag is
// moved *and* reported red.
export function decide({
  tag,
  branch,
  examined,
  maxDrift,
  selfWorkflowPath,
  green,
}: BackstopFacts): Decision {
  if (green === null) {
    return {
      move: false,
      exitCode: 1,
      lines: [
        `::error::no green commit among the ${examined} most recent commits on ${branch}; ${tag} cannot be reconciled`,
      ],
    };
  }

  const promotion = decidePromotion({
    tag,
    sha: green.sha,
    selfWorkflowPath,
    jobs: green.jobs,
    relation: green.relation,
  });

  if (green.aheadBy <= maxDrift) return promotion;

  return {
    ...promotion,
    exitCode: 1,
    lines: [
      ...promotion.lines,
      `::error::${tag} was ${green.aheadBy} commits behind ${green.sha}, past the limit of ${maxDrift}; the event-driven promoter has stopped advancing it`,
    ],
  };
}
