const PASSING_CONCLUSIONS: ReadonlySet<string> = new Set(['success', 'skipped']);

export function isPassingConclusion(conclusion: string | null): boolean {
  return PASSING_CONCLUSIONS.has(conclusion ?? '');
}
