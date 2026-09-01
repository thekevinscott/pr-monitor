export function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { status?: unknown }).status === 404
  );
}
