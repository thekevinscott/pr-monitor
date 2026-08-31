import { expect, test, vi } from 'vitest';
import { moveTag } from './moveTag';
import type { Octokit } from '../types';

function makeClient(updateRef: unknown, createRef: unknown) {
  return { rest: { git: { updateRef, createRef } } } as unknown as Octokit;
}

test('force-updates the existing tag ref', async () => {
  const updateRef = vi.fn().mockResolvedValue({});
  const createRef = vi.fn();

  await moveTag(makeClient(updateRef, createRef), 'o', 'r', 'v1', 'abc');

  expect(updateRef).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    ref: 'tags/v1',
    sha: 'abc',
    force: true,
  });
  expect(createRef).not.toHaveBeenCalled();
});

test('creates the tag when there is none to update', async () => {
  const updateRef = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }));
  const createRef = vi.fn().mockResolvedValue({});

  await moveTag(makeClient(updateRef, createRef), 'o', 'r', 'v1', 'abc');

  expect(createRef).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    ref: 'refs/tags/v1',
    sha: 'abc',
  });
});

test('a non-404 update failure propagates instead of creating a ref', async () => {
  const updateRef = vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { status: 422 }));
  const createRef = vi.fn();

  await expect(moveTag(makeClient(updateRef, createRef), 'o', 'r', 'v1', 'abc')).rejects.toThrow(
    'boom',
  );
  expect(createRef).not.toHaveBeenCalled();
});
