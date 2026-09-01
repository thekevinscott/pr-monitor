import { expect, test } from 'vitest';
import { firstParentChain } from './firstParentChain';
import type { CommitNode } from '../github';

const NODES: CommitNode[] = [
  { sha: 'merge2', parent: 'merge1' },
  { sha: 'branch2', parent: 'merge1' },
  { sha: 'merge1', parent: 'root' },
  { sha: 'branch1', parent: 'root' },
  { sha: 'root', parent: null },
];

test('follows first parents from the tip, skipping merged-in branch commits', () => {
  expect(firstParentChain(NODES)).toEqual(['merge2', 'merge1', 'root']);
});

test('an empty listing yields no chain', () => {
  expect(firstParentChain([])).toEqual([]);
});

test('stops at the edge of the fetched window rather than naming an unread commit', () => {
  expect(firstParentChain([{ sha: 'b', parent: 'a' }])).toEqual(['b']);
});

test('a root commit ends the chain', () => {
  expect(firstParentChain([{ sha: 'root', parent: null }])).toEqual(['root']);
});
