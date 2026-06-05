export function buildExcludedJobs(jobName: string, extras: string[]): string[] {
  return [jobName, ...extras].filter(Boolean);
}
