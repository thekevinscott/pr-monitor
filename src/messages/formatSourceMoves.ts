import type { SourceMove } from '../predict/findSourceMoves';

export function formatSourceMoves(moves: ReadonlyArray<SourceMove>): string {
  return moves
    .map(({ source, sha }) => {
      const now = sha ?? 'could not be re-resolved';
      return `${source.owner}/${source.repo}@${source.ref} ${source.sha} -> ${now}`;
    })
    .join(', ');
}
