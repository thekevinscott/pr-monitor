import { expect, test, vi } from 'vitest';
import { reportFailure } from './reportFailure';
import type { Octokit } from '../types';

const TITLE = 'Scheduled e2e run failed';
const RUN_URL = 'https://github.com/o/r/actions/runs/42';

function makeClient(openIssues: { number: number; title: string }[]) {
  const listForRepo = vi.fn();
  const create = vi.fn().mockResolvedValue({ data: { html_url: 'https://github.com/o/r/issues/7' } });
  const createComment = vi.fn().mockResolvedValue({ data: { html_url: 'https://github.com/o/r/issues/5#c' } });
  const paginate = vi.fn().mockResolvedValue(openIssues);
  const github = { paginate, rest: { issues: { listForRepo, create, createComment } } } as unknown as Octokit;
  return { github, paginate, listForRepo, create, createComment };
}

test('reads every open issue', async () => {
  const { github, paginate, listForRepo } = makeClient([]);

  await reportFailure(github, 'o', 'r', RUN_URL);

  expect(paginate).toHaveBeenCalledWith(listForRepo, { owner: 'o', repo: 'r', state: 'open', per_page: 100 });
});

test('opens a report when none is open', async () => {
  const { github, create, createComment } = makeClient([{ number: 3, title: 'unrelated' }]);

  const line = await reportFailure(github, 'o', 'r', RUN_URL);

  expect(create).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    title: TITLE,
    body: `The scheduled e2e run failed: ${RUN_URL}`,
  });
  expect(createComment).not.toHaveBeenCalled();
  expect(line).toBe('Opened https://github.com/o/r/issues/7');
});

test('comments on the open report instead of opening another', async () => {
  const { github, create, createComment } = makeClient([
    { number: 3, title: 'unrelated' },
    { number: 5, title: TITLE },
  ]);

  const line = await reportFailure(github, 'o', 'r', RUN_URL);

  expect(createComment).toHaveBeenCalledWith({
    owner: 'o',
    repo: 'r',
    issue_number: 5,
    body: `Failed again: ${RUN_URL}`,
  });
  expect(create).not.toHaveBeenCalled();
  expect(line).toBe('Commented on https://github.com/o/r/issues/5#c');
});
