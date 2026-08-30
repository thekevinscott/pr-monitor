import { expect, test, vi } from 'vitest';
import { resolveSourceSha } from './resolveSourceSha';
import type { Octokit } from '../types';

const source = { owner: 'o', repo: 'shared', ref: 'v0' };

function github(getCommit: () => Promise<unknown>): Octokit {
  return { rest: { repos: { getCommit } } } as unknown as Octokit;
}

test('resolves a ref to the commit it names', async () => {
  const getCommit = vi.fn(async () => ({ data: { sha: 'callee-a' } }));
  expect(await resolveSourceSha(github(getCommit), source)).toBe('callee-a');
  expect(getCommit).toHaveBeenCalledWith({ owner: 'o', repo: 'shared', ref: 'v0' });
});

test('a ref that cannot be read is null, never the ref itself', async () => {
  // Deleted tag, private repo, rate limit, network: one answer, and it is not a
  // guess at the commit.
  const failing = github(async () => {
    throw new Error('404');
  });
  expect(await resolveSourceSha(failing, source)).toBeNull();
});
