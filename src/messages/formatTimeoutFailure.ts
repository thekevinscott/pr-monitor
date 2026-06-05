export interface TimeoutContext {
  maxDurationMs: number;
  needsMore: boolean;
  relevantCount: number;
  minimumChecks: number;
  inProgress: string[];
}

export function formatTimeoutFailure(ctx: TimeoutContext): string {
  const mins = Math.round(ctx.maxDurationMs / 1000 / 60);
  if (ctx.needsMore) {
    return `Timeout after ${mins} minutes. Only ${ctx.relevantCount}/${ctx.minimumChecks} required checks appeared.`;
  }
  return `Timeout after ${mins} minutes. Still in progress: ${JSON.stringify(ctx.inProgress)}`;
}
