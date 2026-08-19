import * as core from '@actions/core';
import { context } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { monitor } from './monitor';

export async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GITHUB_TOKEN env var is required');
    return;
  }
  await monitor({ github: new Octokit({ auth: token }), context, core });
}
