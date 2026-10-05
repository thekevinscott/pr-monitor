import { Octokit } from '@octokit/rest';
import { requireEnv } from '../promote/requireEnv';
import { reportFailure } from './reportFailure';

export async function run(): Promise<void> {
  const github = new Octokit({
    auth: requireEnv('GITHUB_TOKEN', process.env.GITHUB_TOKEN),
    baseUrl: process.env.GITHUB_API_URL,
  });

  console.log(
    await reportFailure(
      github,
      requireEnv('E2E_OWNER', process.env.E2E_OWNER),
      requireEnv('E2E_REPO', process.env.E2E_REPO),
      requireEnv('E2E_RUN_URL', process.env.E2E_RUN_URL),
    ),
  );
}
