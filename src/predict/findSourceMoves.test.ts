import { expect, test, vi } from 'vitest';
import { findSourceMoves } from './findSourceMoves';
import type { Octokit } from '../types';

const head = { owner: 'o', repo: 'r', ref: 'head-sha', sha: 'head-sha' };
const callee = { owner: 'o', repo: 'shared', ref: 'v0', sha: 'callee-a' };

function github(shas: Record<string, string | null>) {
  const getCommit = vi.fn(async ({ repo, ref }: { repo: string; ref: string }) => {
    const sha = shas[`${repo}@${ref}`];
    if (sha == null) throw new Error('404');
    return { data: { sha } };
  });
  return { github: { rest: { repos: { getCommit } } } as unknown as Octokit, getCommit };
}

test('a ref that still names the same commit is not a move', async () => {
  const { github: gh } = github({ 'shared@v0': 'callee-a' });
  expect(await findSourceMoves(gh, [callee])).toEqual([]);
});

test('a ref that names a different commit is a move', async () => {
  const { github: gh } = github({ 'shared@v0': 'callee-b' });
  expect(await findSourceMoves(gh, [callee])).toEqual([{ source: callee, sha: 'callee-b' }]);
});

test('a ref that stopped resolving is a move with no commit', async () => {
  const { github: gh } = github({});
  expect(await findSourceMoves(gh, [callee])).toEqual([{ source: callee, sha: null }]);
});

test('a source already pinned to its commit is not asked about', async () => {
  // The PR's own head is recorded by SHA. A SHA cannot move, so asking would
  // spend a request to learn nothing.
  const { github: gh, getCommit } = github({});
  expect(await findSourceMoves(gh, [head])).toEqual([]);
  expect(getCommit).not.toHaveBeenCalled();
});

test('reports only the sources that moved', async () => {
  const other = { owner: 'o', repo: 'other', ref: 'main', sha: 'x' };
  const { github: gh } = github({ 'shared@v0': 'callee-a', 'other@main': 'y' });
  expect(await findSourceMoves(gh, [head, callee, other])).toEqual([{ source: other, sha: 'y' }]);
});
