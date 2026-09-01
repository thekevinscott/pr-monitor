import type { Decision } from '../types';

export const hold = (message: string): Decision => ({
  move: false,
  exitCode: 0,
  lines: [`::notice::${message}`],
});
