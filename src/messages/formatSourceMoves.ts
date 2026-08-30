import type { SourceMove } from '../predict/findSourceMoves';

/**
 * Name what a ref pointed at when the prediction was made and what it points at
 * now, so a reader can tell a moved tag from a real disagreement without going
 * to look the commits up.
 */
export function formatSourceMoves(moves: ReadonlyArray<SourceMove>): string {
  return moves
    .map(({ source, sha }) => {
      const now = sha ?? 'could not be re-resolved';
      return `${source.owner}/${source.repo}@${source.ref} ${source.sha} -> ${now}`;
    })
    .join(', ');
}
