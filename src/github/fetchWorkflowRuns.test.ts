import { expect, test, vi } from 'vitest';
import { fetchWorkflowRuns } from './fetchWorkflowRuns';
import type { Octokit } from '../types';

function makeRun(id: number) {
  return { id, name: `wf-${id}`, status: 'completed', conclusion: 'success' };
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
  expect(result).toEqual([{ id: 7, name: 'wf-7', status: 'completed', conclusion: 'success' }]);
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
  expect(result[100]).toEqual({ id: 101, name: 'wf-101', status: 'completed', conclusion: 'success' });
});

test('defaults null name/status/conclusion to safe values', async () => {
  const listWorkflowRunsForRepo = vi.fn().mockResolvedValue({
    data: { total_count: 1, workflow_runs: [{ id: 3, name: null, status: null, conclusion: null }] },
  });
  const github = { rest: { actions: { listWorkflowRunsForRepo } } } as unknown as Octokit;

  const result = await fetchWorkflowRuns(github, 'o', 'r', 'abc');

  expect(result).toEqual([{ id: 3, name: '', status: '', conclusion: null }]);
});
