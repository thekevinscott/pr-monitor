import * as core from '@actions/core';
import { context } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { makeGithubClient } from 'willfire';
import { monitor } from './monitor';

export async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GITHUB_TOKEN env var is required');
    return;
  }
  const callbacks = (process.env.PR_MONITOR_RESOLVE_OUTPUTS ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  await monitor({
    github: new Octokit({ auth: token }),
    predictClient: makeGithubClient(),
    context,
    core,
    callbacks,
  });
}
