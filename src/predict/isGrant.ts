export function isGrant(spec: string): boolean {
  const colon = spec.indexOf(':');
  if (colon === -1) return false;
  const repo = spec.slice(0, colon).split('/');
  const jobs = spec.slice(colon + 1).split(',').filter((s) => s !== '');
  return repo.length === 2 && repo.every((half) => half !== '') && jobs.length > 0;
}
