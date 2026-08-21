import { expect, test, vi } from 'vitest';
import { fetchWorkflowRunJobs } from './fetchWorkflowRunJobs';
import type { Octokit, WorkflowRunSummary } from '../types';

const run = (id: number, path: string): WorkflowRunSummary => ({
  id,
  name: path,
  path,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
});

const makeJob = (id: number, name: string) => ({
  id,
  name,
  status: 'completed',
  conclusion: 'success',
});

test('asks for the latest attempt of each run and tags jobs with their workflow', async () => {
  const listJobsForWorkflowRun = vi
    .fn()
    .mockResolvedValueOnce({ data: { total_count: 1, jobs: [makeJob(1, 'Build')] } })
    .mockResolvedValueOnce({ data: { total_count: 1, jobs: [makeJob(2, 'Lint')] } });
  const github = { rest: { actions: { listJobsForWorkflowRun } } } as unknown as Octokit;

  const result = await fetchWorkflowRunJobs(github, 'o', 'r', [
    run(10, '.github/workflows/a.yml'),
    run(11, '.github/workflows/b.yml'),
  ]);

  expect(listJobsForWorkflowRun).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    run_id: 10,
    filter: 'latest',
    per_page: 100,
    page: 1,
  });
  expect(result).toEqual([
    {
      id: 1,
      name: 'Build',
      workflowPath: '.github/workflows/a.yml',
      status: 'completed',
      conclusion: 'success',
    },
    {
      id: 2,
      name: 'Lint',
      workflowPath: '.github/workflows/b.yml',
      status: 'completed',
      conclusion: 'success',
    },
  ]);
});

test('paginates one run until a partial page is returned', async () => {
  const fullPage = Array.from({ length: 100 }, (_, i) => makeJob(i + 1, `job-${i + 1}`));
  const listJobsForWorkflowRun = vi
    .fn()
    .mockResolvedValueOnce({ data: { total_count: 101, jobs: fullPage } })
    .mockResolvedValueOnce({ data: { total_count: 101, jobs: [makeJob(101, 'job-101')] } });
  const github = { rest: { actions: { listJobsForWorkflowRun } } } as unknown as Octokit;

  const result = await fetchWorkflowRunJobs(github, 'o', 'r', [run(10, 'a.yml')]);

  expect(listJobsForWorkflowRun).toHaveBeenCalledTimes(2);
  expect(listJobsForWorkflowRun.mock.calls[1]?.[0]).toMatchObject({ page: 2 });
  expect(result).toHaveLength(101);
  expect(result[100]?.name).toBe('job-101');
});

test('no runs → no calls and no jobs', async () => {
  const listJobsForWorkflowRun = vi.fn();
  const github = { rest: { actions: { listJobsForWorkflowRun } } } as unknown as Octokit;

  expect(await fetchWorkflowRunJobs(github, 'o', 'r', [])).toEqual([]);
  expect(listJobsForWorkflowRun).not.toHaveBeenCalled();
});

test('defaults null name/status/conclusion to safe values', async () => {
  const listJobsForWorkflowRun = vi.fn().mockResolvedValue({
    data: { total_count: 1, jobs: [{ id: 3, name: null, status: null, conclusion: null }] },
  });
  const github = { rest: { actions: { listJobsForWorkflowRun } } } as unknown as Octokit;

  const result = await fetchWorkflowRunJobs(github, 'o', 'r', [run(10, 'a.yml')]);

  expect(result).toEqual([
    { id: 3, name: '', workflowPath: 'a.yml', status: '', conclusion: null },
  ]);
});
