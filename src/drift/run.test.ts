import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { rest } = vi.hoisted(() => ({
  rest: {
    git: { getRef: vi.fn() },
    repos: { compareCommitsWithBasehead: vi.fn() },
  },
}));

vi.mock('@octokit/rest', async () => {
  const actual = await vi.importActual<typeof import('@octokit/rest')>('@octokit/rest');
  return { ...actual, Octokit: vi.fn(() => ({ rest })) };
});

import { Octokit } from '@octokit/rest';
import { run } from './run';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = 'tok';
  process.env.DRIFT_OWNER = 'o';
  process.env.DRIFT_REPO = 'r';
  process.env.DRIFT_TAG = 'v1';
  process.env.DRIFT_BRANCH = 'main';
  process.env.DRIFT_LIMIT = '3';
  rest.git.getRef.mockResolvedValue({ data: {} });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('compares the tag against the branch and passes a small gap', async () => {
  rest.repos.compareCommitsWithBasehead.mockResolvedValue({
    data: { status: 'ahead', ahead_by: 1 },
  });

  const code = await run();

  expect(Octokit).toHaveBeenCalledWith({ auth: 'tok' });
  expect(rest.git.getRef).toHaveBeenCalledWith({ owner: 'o', repo: 'r', ref: 'tags/v1' });
  expect(rest.repos.compareCommitsWithBasehead).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    basehead: 'v1...main',
  });
  expect(console.log).toHaveBeenCalledWith('::notice::v1 lags main by 1, within the limit of 3');
  expect(code).toBe(0);
});

test('returns the decided exit code when the gap is too wide', async () => {
  rest.repos.compareCommitsWithBasehead.mockResolvedValue({
    data: { status: 'ahead', ahead_by: 40 },
  });

  expect(await run()).toBe(1);
});

test.each([
  'GITHUB_TOKEN',
  'DRIFT_OWNER',
  'DRIFT_REPO',
  'DRIFT_TAG',
  'DRIFT_BRANCH',
  'DRIFT_LIMIT',
])('a missing %s fails by name before any request is made', async (name) => {
  delete process.env[name];

  await expect(run()).rejects.toThrow(`${name} is required`);
  expect(rest.git.getRef).not.toHaveBeenCalled();
});

test('an unusable limit fails before any request is made', async () => {
  process.env.DRIFT_LIMIT = 'lots';

  await expect(run()).rejects.toThrow('DRIFT_LIMIT must be a positive integer');
  expect(rest.git.getRef).not.toHaveBeenCalled();
});
