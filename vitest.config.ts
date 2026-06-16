import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Relative to Vitest's root so the suite is found both from the repo root
    // (normal `pnpm test`) and when run from inside `src/` (the
    // testing-conventions coverage check invokes vitest there).
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types.ts', 'src/entry.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
