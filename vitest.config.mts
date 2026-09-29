import { defaultExclude, defineConfig, mergeConfig } from 'vitest/config';
import { vitestConfig } from 'testing-conventions';

export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      // Root-relative: the testing-conventions CLI invokes Vitest with `src/` as root.
      include: ['**/*.test.ts'],
      // Untracked agent worktrees under `.claude/` and `.worktrees/` hold stale
      // copies of this suite. Workspace packages own their own suite, config
      // and Vitest major — willfire is on 4.x while this root is on 2.x, and
      // running its tests from here silently changes mock isolation.
      exclude: [
        ...defaultExclude,
        '**/.claude/**',
        '**/.worktrees/**',
        'packages/**',
      ],
      coverage: {
        // mergeConfig concatenates, so these add to the base's excludes rather than replace them.
        // The testing-conventions CLI ignores them; they only scope the local `test:coverage` report.
        exclude: [
          '**/*.test.ts',
          '**/types.ts',
        ],
        reporter: ['text', 'json-summary'],
      },
    },
  }),
);
