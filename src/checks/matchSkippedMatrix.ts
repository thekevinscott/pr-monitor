/** A skipped matrix job reports its unevaluated name once, instead of one name per cell. */
export function matchSkippedMatrix(name: string, expectedNames: ReadonlySet<string>): string[] {
  const parts = name.split(/(\$\{\{\s*matrix\.[\w.-]+\s*\}\})/g);
  if (parts.length === 1) return [];

  const pattern = new RegExp(
    `^${parts.map((part, index) =>
      index % 2 === 1 ? '.*' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ).join('')}$`,
  );
  return [...expectedNames].filter((expected) => pattern.test(expected));
}
