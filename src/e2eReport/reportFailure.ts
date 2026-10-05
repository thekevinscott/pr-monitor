import type { Octokit } from '../types';

export const REPORT_TITLE = 'Scheduled e2e run failed';

export async function reportFailure(github: Octokit, owner: string, repo: string, runUrl: string): Promise<string> {
  const open = await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'open', per_page: 100 });
  const existing = open.find((issue) => issue.title === REPORT_TITLE);

  if (existing) {
    const { data } = await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: existing.number,
      body: `Failed again: ${runUrl}`,
    });
    return `Commented on ${data.html_url}`;
  }

  const { data } = await github.rest.issues.create({
    owner,
    repo,
    title: REPORT_TITLE,
    body: `The scheduled e2e run failed: ${runUrl}`,
  });
  return `Opened ${data.html_url}`;
}
