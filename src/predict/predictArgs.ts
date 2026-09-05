import type { PredictInputs } from '../types';

export function predictArgs(
  slug: string,
  pullNumber: number,
  { action, callbacks = [] }: PredictInputs,
): string[] {
  return [
    '--repo',
    slug,
    '--pr',
    String(pullNumber),
    ...(action === undefined ? [] : ['--action', action]),
    ...callbacks.flatMap((command) => ['--callback', command]),
    '--json',
  ];
}
