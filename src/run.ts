import * as core from '@actions/core';
import { context } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { monitor } from './monitor';
import { parseGrants } from './predict';

export async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed('GITHUB_TOKEN env var is required');
    return;
  }
  // A grant is permission to execute code, so a malformed one fails the gate
  // here, named, rather than being dropped and resurfacing as a red about
  // dynamic matrices.
  const parsed = parseGrants(process.env.PR_MONITOR_EXECUTE ?? '');
  if ('malformed' in parsed) {
    core.setFailed(
      `execute input entry '${parsed.malformed}' is not owner/repo:job1,job2`,
    );
    return;
  }
  await monitor({
    github: new Octokit({ auth: token }),
    context,
    core,
    execute: parsed.grants,
  });
}
