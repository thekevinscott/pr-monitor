import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestConfig } from 'testing-conventions';

// Extends testing-conventions' published vitest base — v8 coverage over
// `src/**/*.ts` at the 100/100/100/100 floor — so a local `pnpm run test:coverage`
// is held to the same standard the CI gate enforces. Keep the block below to
// project-specific overrides only; the floor itself lives upstream.
export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      // The base glob is relative to Vitest's root — the repo root for a normal
      // `pnpm test`, but `src/` when the testing-conventions CLI invokes Vitest
      // there. This root-relative pattern finds the suite under either root.
      include: ['**/*.test.ts'],
      coverage: {
        // The CLI measures the whole `src/` tree and ignores these excludes; they
        // only scope the local `pnpm test:coverage` report. mergeConfig concatenates,
        // so they add to the base's `src/**/*.d.ts` rather than replacing it.
        exclude: [
          '**/*.test.ts', // tests are not themselves subjects of coverage
          '**/types.ts', // type-only declarations; no runtime to measure
        ],
        reporter: ['text', 'json-summary'],
      },
    },
  }),
);
