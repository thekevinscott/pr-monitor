import { expect, test, vi } from 'vitest';
import { fetchCheckRuns } from './fetchCheckRuns';
import type { Octokit } from '../types';

test('calls listForRef with correct args and returns check_runs', async () => {
  const listForRef = vi.fn().mockResolvedValue({
    data: { check_runs: [{ name: 'A', status: 'completed', conclusion: 'success' }] },
  });
  const github = { rest: { checks: { listForRef } } } as unknown as Octokit;

  const result = await fetchCheckRuns(github, 'o', 'r', 'abc');

  expect(listForRef).toHaveBeenCalledWith({ owner: 'o', repo: 'r', ref: 'abc', per_page: 100 });
  expect(result).toEqual([{ name: 'A', status: 'completed', conclusion: 'success' }]);
});
