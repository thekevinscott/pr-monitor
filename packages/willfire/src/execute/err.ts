export function err(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}
