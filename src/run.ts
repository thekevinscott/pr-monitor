import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { monitor } from './monitor';

export async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GITHUB_TOKEN env var is required');
    return;
  }
  const github = getOctokit(token);
  await monitor({ github, context, core });
}
