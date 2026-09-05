import * as core from '@actions/core';
import { context } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { makeGithubClient } from 'willfire';
import { monitor } from './monitor';
import { makePredictor } from './predict/makePredictor';
import { willfireCliPath } from './predict/willfireCliPath';

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
    // Reconciliation re-resolves refs in process; only prediction goes out to the CLI.
    predictClient: makeGithubClient(),
    predict: makePredictor(willfireCliPath(), token),
    context,
    core,
    callbacks,
  });
}
