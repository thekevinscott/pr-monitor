import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { rest } = vi.hoisted(() => ({
  rest: {
    actions: {
      listWorkflowRunsForRepo: vi.fn(),
      listJobsForWorkflowRun: vi.fn(),
    },
    git: { getRef: vi.fn(), updateRef: vi.fn() },
    repos: { compareCommitsWithBasehead: vi.fn() },
  },
}));

vi.mock('@octokit/rest', async () => {
  const actual = await vi.importActual<typeof import('@octokit/rest')>('@octokit/rest');
  return { ...actual, Octokit: vi.fn(() => ({ rest })) };
});

vi.mock('./promote', async () => {
  const actual = await vi.importActual<typeof import('./promote')>('./promote');
  return { ...actual, promote: vi.fn() };
});

import { Octokit } from '@octokit/rest';
import { promote } from './promote';
import type { PromotionIO, PromotionTarget } from './promote';
import { run } from './run';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = 'tok';
  process.env.PROMOTE_OWNER = 'o';
  process.env.PROMOTE_REPO = 'r';
  process.env.PROMOTE_TAG = 'v1';
  process.env.PROMOTE_SHA = 'abc123';
  process.env.GITHUB_WORKFLOW_REF = 'o/r/.github/workflows/move-major-tag.yml@refs/heads/main';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('passes the environment through as the promotion target', async () => {
  vi.mocked(promote).mockResolvedValue({ exitCode: 0, lines: ['::notice::v1 → abc123'] });

  const code = await run();

  expect(Octokit).toHaveBeenCalledWith({ auth: 'tok' });
  expect(vi.mocked(promote).mock.calls[0]?.[0]).toEqual<PromotionTarget>({
    tag: 'v1',
    sha: 'abc123',
    selfWorkflowPath: '.github/workflows/move-major-tag.yml',
  });
  expect(console.log).toHaveBeenCalledWith('::notice::v1 → abc123');
  expect(code).toBe(0);
});

test('returns the decided exit code', async () => {
  vi.mocked(promote).mockResolvedValue({ exitCode: 1, lines: [] });

  expect(await run()).toBe(1);
  expect(console.log).not.toHaveBeenCalled();
});

test('a missing variable fails before any request is made', async () => {
  delete process.env.PROMOTE_SHA;

  await expect(run()).rejects.toThrow('PROMOTE_SHA is required');
  expect(promote).not.toHaveBeenCalled();
});

test('wires the injected I/O to the REST client', async () => {
  rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
    data: { workflow_runs: [{ id: 5, path: '.github/workflows/test.yml' }] },
  });
  rest.actions.listJobsForWorkflowRun.mockResolvedValue({
    data: { jobs: [{ id: 9, name: 'Lint', status: 'completed', conclusion: 'success' }] },
  });
  rest.git.getRef.mockResolvedValue({ data: {} });
  rest.repos.compareCommitsWithBasehead.mockResolvedValue({ data: { status: 'ahead' } });
  rest.git.updateRef.mockResolvedValue({});

  let io: PromotionIO | undefined;
  vi.mocked(promote).mockImplementation(async (_target, injected) => {
    io = injected;
    return { exitCode: 0, lines: [] };
  });

  await run();

  expect(await io?.fetchJobs('abc123')).toEqual([
    {
      id: 9,
      name: 'Lint',
      workflowPath: '.github/workflows/test.yml',
      status: 'completed',
      conclusion: 'success',
    },
  ]);
  expect(rest.actions.listWorkflowRunsForRepo).toHaveBeenCalledWith(
    expect.objectContaining({ owner: 'o', repo: 'r', head_sha: 'abc123' }),
  );

  expect(await io?.compare('v1', 'abc123')).toBe('ahead');

  await io?.moveTag('v1', 'abc123');
  expect(rest.git.updateRef).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    ref: 'tags/v1',
    sha: 'abc123',
    force: true,
  });
});
