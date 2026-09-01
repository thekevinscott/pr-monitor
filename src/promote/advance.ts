import type { Decision } from '../types';

export const advance = (message: string): Decision => ({
  move: true,
  exitCode: 0,
  lines: [`::notice::${message}`],
});
