import * as core from '@actions/core';
import { context } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { makeGithubClient } from 'willfire';
import { monitor } from './monitor';
import { parseExecute } from './predict/parseExecute';

export async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GITHUB_TOKEN env var is required');
    return;
  }
  const parsed = parseExecute(process.env.PR_MONITOR_EXECUTE ?? '');
  if ('malformed' in parsed) {
    core.setFailed(
      `execute input value '${parsed.malformed}' is neither true nor false`,
    );
    return;
  }
  if (parsed.legacy !== null) {
    core.warning(
      `execute: ${parsed.legacy} uses the retired owner/repo:job1,job2 spelling; neither the repo nor the job in it scopes anything. Reading it as execute: true — write that instead.`,
    );
  }
  await monitor({
    github: new Octokit({ auth: token }),
    // Reads GH_TOKEN / GITHUB_TOKEN from the environment itself; `token` above
    // is the same value, checked here so the failure names the missing var.
    predictClient: makeGithubClient(),
    context,
    core,
    execute: parsed.execute,
  });
}
