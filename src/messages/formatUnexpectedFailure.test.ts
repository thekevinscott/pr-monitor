import { expect, test } from 'vitest';
import { formatUnexpectedFailure } from './formatUnexpectedFailure';

test('names the unpredicted runs and why that is fatal', () => {
  const msg = formatUnexpectedFailure(['.github/workflows/surprise.yml'], []);
  expect(msg).toContain('Unpredicted workflow runs: [".github/workflows/surprise.yml"]');
  expect(msg).not.toContain('Unpredicted check names');
  expect(msg).toContain('willfire did not predict them');
});

test('names the unpredicted check names', () => {
  const msg = formatUnexpectedFailure([], ['a.yml :: Build (renamed)']);
  expect(msg).toContain('Unpredicted check names: ["a.yml :: Build (renamed)"]');
  expect(msg).not.toContain('Unpredicted workflow runs');
  expect(msg).toContain('renamed job');
});

test('reports both kinds at once', () => {
  const msg = formatUnexpectedFailure(['surprise.yml'], ['a.yml :: Surprise']);
  expect(msg).toContain('Unpredicted workflow runs: ["surprise.yml"]');
  expect(msg).toContain('Unpredicted check names: ["a.yml :: Surprise"]');
});
