import { expect, test } from 'vitest';
import { collectRunScripts } from './collectRunScripts';

test('collects every step script in a workflow, in document order', () => {
  const doc = {
    jobs: {
      test: { steps: [{ uses: 'actions/checkout@v5' }, { run: 'pnpm test' }] },
      lint: { steps: [{ run: 'pnpm lint' }] },
    },
  };
  expect(collectRunScripts(doc)).toEqual(['pnpm test', 'pnpm lint']);
});

test('collects composite action scripts, which sit under a different key path', () => {
  const doc = { runs: { using: 'composite', steps: [{ run: 'pnpm build' }] } };
  expect(collectRunScripts(doc)).toEqual(['pnpm build']);
});

test('`runs-on` is not a script', () => {
  expect(collectRunScripts({ jobs: { a: { 'runs-on': 'ubuntu-latest' } } })).toEqual([]);
});

test('a non-string run value carries no script of its own', () => {
  expect(collectRunScripts({ run: 42 })).toEqual([]);
});

test('scalars, null and empty documents yield nothing', () => {
  expect(collectRunScripts(null)).toEqual([]);
  expect(collectRunScripts('pnpm test')).toEqual([]);
  expect(collectRunScripts([])).toEqual([]);
});
