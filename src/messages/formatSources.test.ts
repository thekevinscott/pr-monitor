import { expect, test } from 'vitest';
import { formatSources } from './formatSources';

test('names each repo, the ref, and the commit it resolved to', () => {
  const msg = formatSources([
    { owner: 'o', repo: 'r', ref: 'head-sha', sha: 'head-sha' },
    { owner: 'o', repo: 'shared', ref: 'v0', sha: 'callee-a' },
  ]);
  expect(msg).toBe('o/r@head-sha -> head-sha, o/shared@v0 -> callee-a');
});

test('says nothing when a prediction read nothing', () => {
  expect(formatSources([])).toBe('');
});
