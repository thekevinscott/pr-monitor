import { expect, test, vi } from 'vitest';
import { fetchWorkflowRuns } from './fetchWorkflowRuns';
import type { Octokit } from '../types';

function makeRun(id: number) {
  return {
    id,
    name: `wf-${id}`,
    path: `.github/workflows/wf-${id}.yml`,
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
  };
}

test('calls listWorkflowRunsForRepo with head_sha and maps the runs', async () => {
  const listWorkflowRunsForRepo = vi.fn().mockResolvedValue({
    data: { total_count: 1, workflow_runs: [makeRun(7)] },
  });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  const result = await fetchWorkflowRuns(github, 'o', 'r', 'abc');

  expect(listWorkflowRunsForRepo).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    head_sha: 'abc',
    per_page: 100,
    page: 1,
  });
  expect(result).toEqual([makeRun(7)]);
});

test('paginates until a partial page is returned', async () => {
  const fullPage = Array.from({ length: 100 }, (_, i) => makeRun(i + 1));
  const lastPage = [makeRun(101)];
  const listWorkflowRunsForRepo = vi
    .fn()
    .mockResolvedValueOnce({ data: { total_count: 101, workflow_runs: fullPage } })
    .mockResolvedValueOnce({ data: { total_count: 101, workflow_runs: lastPage } });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  const result = await fetchWorkflowRuns(github, 'o', 'r', 'abc');

  expect(listWorkflowRunsForRepo).toHaveBeenCalledTimes(2);
  expect(listWorkflowRunsForRepo.mock.calls[0]?.[0]).toMatchObject({ page: 1 });
  expect(listWorkflowRunsForRepo.mock.calls[1]?.[0]).toMatchObject({ page: 2 });
  expect(result).toHaveLength(101);
  expect(result[100]).toEqual(makeRun(101));
});

test('defaults null name/path/event/status/conclusion to safe values', async () => {
  const listWorkflowRunsForRepo = vi.fn().mockResolvedValue({
    data: {
      total_count: 1,
      workflow_runs: [{ id: 3, name: null, path: null, event: null, status: null, conclusion: null }],
    },
  });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  const result = await fetchWorkflowRuns(github, 'o', 'r', 'abc');

  expect(result).toEqual([{ id: 3, name: '', path: '', event: '', status: '', conclusion: null }]);
});

test('an error-shaped body fails with the upstream status, not a TypeError', async () => {
  const listWorkflowRunsForRepo = vi.fn().mockResolvedValue({
    status: 200,
    data: { message: 'Server Error', documentation_url: 'https://docs.github.com/rest' },
  });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  await expect(fetchWorkflowRuns(github, 'o', 'r', 'abc')).rejects.toThrow(
    'GitHub returned 200 listing workflow runs for abc: expected an array at data.workflow_runs, got {"message":"Server Error","documentation_url":"https://docs.github.com/rest"}',
  );
});

test('a non-2xx with no body fails with the upstream status', async () => {
  const listWorkflowRunsForRepo = vi.fn().mockResolvedValue({ status: 502, data: undefined });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  await expect(fetchWorkflowRuns(github, 'o', 'r', 'abc')).rejects.toThrow(
    'GitHub returned 502 listing workflow runs for abc: expected an array at data.workflow_runs, got undefined',
  );
});

test('a failed later page rejects instead of returning the pages already read', async () => {
  const fullPage = Array.from({ length: 100 }, (_, i) => makeRun(i + 1));
  const listWorkflowRunsForRepo = vi
    .fn()
    .mockResolvedValueOnce({ status: 200, data: { total_count: 101, workflow_runs: fullPage } })
    .mockResolvedValueOnce({ status: 502, data: { message: 'Server Error' } });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  await expect(fetchWorkflowRuns(github, 'o', 'r', 'abc')).rejects.toThrow(
    'GitHub returned 502 listing workflow runs for abc: expected an array at data.workflow_runs, got {"message":"Server Error"}',
  );
});
