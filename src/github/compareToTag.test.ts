import { expect, test, vi } from 'vitest';
import { compareToTag } from './compareToTag';
import type { Octokit } from '../types';

function makeClient(getRef: unknown, compare?: unknown) {
  return {
    rest: {
      git: { getRef },
      repos: { compareCommitsWithBasehead: compare },
    },
  } as unknown as Octokit;
}

test('an absent tag ref reports missing without comparing', async () => {
  const getRef = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }));
  const compare = vi.fn();

  expect(await compareToTag(makeClient(getRef, compare), 'o', 'r', 'v1', 'abc')).toBe('missing');
  expect(getRef).toHaveBeenCalledWith({ owner: 'o', repo: 'r', ref: 'tags/v1' });
  expect(compare).not.toHaveBeenCalled();
});

test('a non-404 on the tag ref propagates rather than reading as missing', async () => {
  const getRef = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

  await expect(compareToTag(makeClient(getRef, vi.fn()), 'o', 'r', 'v1', 'abc')).rejects.toThrow(
    'boom',
  );
});

test('compares the tag name against the commit and returns the status', async () => {
  const getRef = vi.fn().mockResolvedValue({ data: { object: { sha: 'old' } } });
  const compare = vi.fn().mockResolvedValue({ data: { status: 'ahead' } });

  expect(await compareToTag(makeClient(getRef, compare), 'o', 'r', 'v1', 'abc')).toBe('ahead');
  expect(compare).toHaveBeenCalledWith({ owner: 'o', repo: 'r', basehead: 'v1...abc' });
});

test('passes a diverged status straight through', async () => {
  const getRef = vi.fn().mockResolvedValue({ data: { object: { sha: 'old' } } });
  const compare = vi.fn().mockResolvedValue({ data: { status: 'diverged' } });

  expect(await compareToTag(makeClient(getRef, compare), 'o', 'r', 'v1', 'abc')).toBe('diverged');
});
