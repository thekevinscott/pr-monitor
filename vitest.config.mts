import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestConfig } from 'testing-conventions';

export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      // Root-relative: the testing-conventions CLI invokes Vitest with `src/` as root.
      include: ['**/*.test.ts'],
      coverage: {
        // mergeConfig concatenates, so these add to the base's excludes rather than replace them.
        exclude: [
          '**/*.test.ts',
          '**/types.ts',
        ],
        reporter: ['text', 'json-summary'],
      },
    },
  }),
);
