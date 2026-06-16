// A workflow run is non-blocking when it neither failed nor needs attention.
// `neutral`/`stale` runs (e.g. superseded or intentionally inconclusive) must not
// fail the gate; `cancelled`/`timed_out`/`action_required`/`failure` must.
const PASSING_CONCLUSIONS: ReadonlySet<string> = new Set(['success', 'skipped', 'neutral', 'stale']);

export function isPassingConclusion(conclusion: string | null): boolean {
  return PASSING_CONCLUSIONS.has(conclusion ?? '');
}
