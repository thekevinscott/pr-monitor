export interface ProgressContext {
  inProgress: string[];
  relevantCount: number;
  minimumChecks: number;
  durationSec: number;
}

export function formatProgressLog(ctx: ProgressContext): string {
  const parts: string[] = [];
  if (ctx.relevantCount < ctx.minimumChecks) {
    parts.push(`waiting for runs: ${ctx.relevantCount}/${ctx.minimumChecks}`);
  }
  if (ctx.inProgress.length > 0) {
    parts.push(`in progress: ${JSON.stringify(ctx.inProgress)}`);
  }
  return `${parts.join(' | ')} | elapsed: ${ctx.durationSec}s`;
}
