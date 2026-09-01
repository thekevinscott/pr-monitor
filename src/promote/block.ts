import type { Decision } from '../types';

export const block = (message: string): Decision => ({
  move: false,
  exitCode: 1,
  lines: [`::error::${message}`],
});
