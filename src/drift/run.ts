import { Octokit } from '@octokit/rest';
import { compareToTag } from '../github';
import { requireEnv } from '../promote/requireEnv';
import { decide } from './decide';
import { requireCount } from './requireCount';

// Composition root. No rule of its own.
export async function run(): Promise<number> {
  const github = new Octokit({ auth: requireEnv('GITHUB_TOKEN', process.env.GITHUB_TOKEN) });
  const owner = requireEnv('DRIFT_OWNER', process.env.DRIFT_OWNER);
  const repo = requireEnv('DRIFT_REPO', process.env.DRIFT_REPO);
  const tag = requireEnv('DRIFT_TAG', process.env.DRIFT_TAG);
  const branch = requireEnv('DRIFT_BRANCH', process.env.DRIFT_BRANCH);
  const limit = requireCount('DRIFT_LIMIT', process.env.DRIFT_LIMIT);

  const { relation, aheadBy } = await compareToTag(github, owner, repo, tag, branch);
  const { exitCode, lines } = decide({ tag, branch, relation, aheadBy, limit });

  lines.forEach((line) => console.log(line));
  return exitCode;
}
