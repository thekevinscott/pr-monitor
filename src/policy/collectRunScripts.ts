/**
 * Every `run:` script in a parsed YAML document, in document order.
 *
 * Walks the whole tree rather than the two key paths that carry steps today
 * (`jobs.*.steps` in a workflow, `runs.steps` in a composite action), so a
 * shape the gate has not met yet still gets read.
 */
export function collectRunScripts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap((item) => collectRunScripts(item));
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'run' && typeof value === 'string' ? [value] : collectRunScripts(value),
  );
}
