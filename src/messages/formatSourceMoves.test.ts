import { expect, test } from 'vitest';
import { formatSourceMoves } from './formatSourceMoves';

const source = { owner: 'o', repo: 'shared', ref: 'v0', sha: 'callee-a' };

test('names where a ref pointed and where it points now', () => {
  expect(formatSourceMoves([{ source, sha: 'callee-b' }])).toBe(
    'o/shared@v0 callee-a -> callee-b',
  );
});

test('spells out a ref that no longer resolves rather than printing null', () => {
  expect(formatSourceMoves([{ source, sha: null }])).toBe(
    'o/shared@v0 callee-a -> could not be re-resolved',
  );
});

test('joins several moves', () => {
  const other = { owner: 'o', repo: 'other', ref: 'main', sha: 'x' };
  expect(formatSourceMoves([{ source, sha: 'callee-b' }, { source: other, sha: 'y' }])).toBe(
    'o/shared@v0 callee-a -> callee-b, o/other@main x -> y',
  );
});
