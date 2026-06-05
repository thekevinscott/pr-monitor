export function computeRemainingPreSleep(
  preSleepMs: number,
  actionStartMs: number,
  nowMs: number,
): number {
  if (actionStartMs <= 0) return preSleepMs;
  const elapsed = nowMs - actionStartMs;
  return Math.max(0, preSleepMs - elapsed);
}
