import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Workspace packages carry their own config with their own rules, and
    // those `files` globs are relative to the package. Linting them from here
    // would apply this weaker rule set instead of theirs.
    ignores: ['dist/', 'coverage/', 'node_modules/', 'packages/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
);
