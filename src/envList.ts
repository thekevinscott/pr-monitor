export function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
