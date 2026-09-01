import { decide } from './decide';
import { findGreenHead } from './findGreenHead';
import { firstParentChain } from './firstParentChain';
import type { GreenSearchIO } from './findGreenHead';
import type { CommitNode } from '../github';
import type { Outcome } from '../promote/promote';

export interface BackstopTarget {
  tag: string;
  branch: string;
  depth: number;
  maxDrift: number;
  selfWorkflowPath: string | null;
}

export interface BackstopIO extends GreenSearchIO {
  listCommits: (branch: string, depth: number) => Promise<CommitNode[]>;
  moveTag: (tag: string, sha: string) => Promise<void>;
}

export async function backstop(target: BackstopTarget, io: BackstopIO): Promise<Outcome> {
  const chain = firstParentChain(await io.listCommits(target.branch, target.depth));
  const green = await findGreenHead(chain, target.tag, target.selfWorkflowPath, io);

  const decision = decide({
    tag: target.tag,
    branch: target.branch,
    examined: chain.length,
    maxDrift: target.maxDrift,
    selfWorkflowPath: target.selfWorkflowPath,
    green,
  });

  if (green !== null && decision.move) {
    await io.moveTag(target.tag, green.sha);
  }

  return { exitCode: decision.exitCode, lines: decision.lines };
}
