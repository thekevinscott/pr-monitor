import { expect, test, vi } from 'vitest';
import { MAX_COMMITS, listBranchCommits } from './listBranchCommits';
import type { Octokit } from '../types';

function makeClient(listCommits: unknown) {
  return { rest: { repos: { listCommits } } } as unknown as Octokit;
}

test('asks for the branch tip and keeps only first parents', async () => {
  const listCommits = vi.fn().mockResolvedValue({
    data: [
      { sha: 'merge', parents: [{ sha: 'prev' }, { sha: 'branch' }] },
      { sha: 'prev', parents: [] },
    ],
  });

  expect(await listBranchCommits(makeClient(listCommits), 'o', 'r', 'main', 20)).toEqual([
    { sha: 'merge', parent: 'prev' },
    { sha: 'prev', parent: null },
  ]);
  expect(listCommits).toHaveBeenCalledWith({ owner: 'o', repo: 'r', sha: 'main', per_page: 20 });
});

test('publishes the page cap the depth is bounded by', () => {
  expect(MAX_COMMITS).toBe(100);
});
