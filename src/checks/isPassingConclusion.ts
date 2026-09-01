// `neutral`/`stale` must not fail the gate; `cancelled`/`timed_out`/`action_required` must.
const PASSING_CONCLUSIONS: ReadonlySet<string> = new Set(['success', 'skipped', 'neutral', 'stale']);

export function isPassingConclusion(conclusion: string | null): boolean {
  return PASSING_CONCLUSIONS.has(conclusion ?? '');
}
