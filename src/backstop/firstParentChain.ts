import type { CommitNode } from '../github';

// A branch listing includes every ancestor, so merged-in PR commits appear in it;
// tagging one would point consumers at a pre-merge commit.
export function firstParentChain(nodes: ReadonlyArray<CommitNode>): string[] {
  const parents = new Map(nodes.map((node) => [node.sha, node.parent]));
  const chain: string[] = [];

  let sha: string | null | undefined = nodes[0]?.sha;
  while (sha != null && parents.has(sha)) {
    chain.push(sha);
    sha = parents.get(sha);
  }

  return chain;
}
