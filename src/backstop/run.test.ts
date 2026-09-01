import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { rest } = vi.hoisted(() => ({
  rest: {
    actions: {
      listWorkflowRunsForRepo: vi.fn(),
      listJobsForWorkflowRun: vi.fn(),
    },
    git: { getRef: vi.fn(), updateRef: vi.fn() },
    repos: { compareCommitsWithBasehead: vi.fn(), listCommits: vi.fn() },
  },
}));

vi.mock('@octokit/rest', async () => {
  const actual = await vi.importActual<typeof import('@octokit/rest')>('@octokit/rest');
  return { ...actual, Octokit: vi.fn(() => ({ rest })) };
});

vi.mock('./backstop', async () => {
  const actual = await vi.importActual<typeof import('./backstop')>('./backstop');
  return { ...actual, backstop: vi.fn() };
});

import { Octokit } from '@octokit/rest';
import { backstop } from './backstop';
import type { BackstopIO, BackstopTarget } from './backstop';
import { run } from './run';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = 'tok';
  process.env.BACKSTOP_OWNER = 'o';
  process.env.BACKSTOP_REPO = 'r';
  process.env.BACKSTOP_TAG = 'v1';
  process.env.BACKSTOP_BRANCH = 'main';
  process.env.BACKSTOP_DEPTH = '20';
  process.env.BACKSTOP_MAX_DRIFT = '3';
  process.env.GITHUB_WORKFLOW_REF =
    'o/r/.github/workflows/backstop-major-tag.yml@refs/heads/main';
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('passes the environment through as the reconciliation target', async () => {
  vi.mocked(backstop).mockResolvedValue({ exitCode: 0, lines: ['::notice::v1 → abc123'] });

  const code = await run();

  expect(Octokit).toHaveBeenCalledWith({ auth: 'tok' });
  expect(vi.mocked(backstop).mock.calls[0]?.[0]).toEqual<BackstopTarget>({
    tag: 'v1',
    branch: 'main',
    depth: 20,
    maxDrift: 3,
    selfWorkflowPath: '.github/workflows/backstop-major-tag.yml',
  });
  expect(console.log).toHaveBeenCalledWith('::notice::v1 → abc123');
  expect(code).toBe(0);
});

test('returns the decided exit code', async () => {
  vi.mocked(backstop).mockResolvedValue({ exitCode: 1, lines: [] });

  expect(await run()).toBe(1);
});

test('a missing variable fails before any request is made', async () => {
  delete process.env.BACKSTOP_BRANCH;

  await expect(run()).rejects.toThrow('BACKSTOP_BRANCH is required');
  expect(backstop).not.toHaveBeenCalled();
});

test('an unusable drift limit fails before any request is made', async () => {
  process.env.BACKSTOP_MAX_DRIFT = 'lots';

  await expect(run()).rejects.toThrow('BACKSTOP_MAX_DRIFT must be an integer between 1 and 100');
  expect(backstop).not.toHaveBeenCalled();
});

test('wires the injected I/O to the REST client', async () => {
  rest.repos.listCommits.mockResolvedValue({
    data: [{ sha: 'head', parents: [{ sha: 'prev' }] }],
  });
  rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
    data: { workflow_runs: [{ id: 5, path: '.github/workflows/test.yml' }] },
  });
  rest.actions.listJobsForWorkflowRun.mockResolvedValue({
    data: { jobs: [{ id: 9, name: 'Lint', status: 'completed', conclusion: 'success' }] },
  });
  rest.git.getRef.mockResolvedValue({ data: {} });
  rest.repos.compareCommitsWithBasehead.mockResolvedValue({
    data: { status: 'ahead', ahead_by: 2 },
  });
  rest.git.updateRef.mockResolvedValue({});

  let io: BackstopIO | undefined;
  vi.mocked(backstop).mockImplementation(async (_target, injected) => {
    io = injected;
    return { exitCode: 0, lines: [] };
  });

  await run();

  expect(await io?.listCommits('main', 20)).toEqual([{ sha: 'head', parent: 'prev' }]);
  expect(rest.repos.listCommits).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    sha: 'main',
    per_page: 20,
  });

  expect(await io?.fetchJobs('head')).toEqual([
    {
      id: 9,
      name: 'Lint',
      workflowPath: '.github/workflows/test.yml',
      status: 'completed',
      conclusion: 'success',
    },
  ]);

  expect(await io?.compare('v1', 'head')).toEqual({ relation: 'ahead', aheadBy: 2 });

  await io?.moveTag('v1', 'head');
  expect(rest.git.updateRef).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    ref: 'tags/v1',
    sha: 'head',
    force: true,
  });
});
