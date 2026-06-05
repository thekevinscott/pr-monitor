export function envInt(name: string, defaultValue: number): number {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isNaN(n) ? defaultValue : n;
}
