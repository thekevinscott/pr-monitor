import { Octokit } from '@octokit/rest';
import {
  compareToTag,
  fetchWorkflowRunJobs,
  fetchWorkflowRuns,
  moveTag,
  resolveSelfWorkflowPath,
} from '../github';
import { promote } from './promote';
import { requireEnv } from './requireEnv';

/**
 * Composition root: reads the environment, builds the client, hands both to
 * `promote`, and writes what it is told to write. No rule of its own — the
 * promotion decision belongs to `decide`, and the exit belongs to the entrypoint.
 */
export async function run(): Promise<number> {
  const github = new Octokit({ auth: requireEnv('GITHUB_TOKEN', process.env.GITHUB_TOKEN) });
  const owner = requireEnv('PROMOTE_OWNER', process.env.PROMOTE_OWNER);
  const repo = requireEnv('PROMOTE_REPO', process.env.PROMOTE_REPO);

  const { exitCode, lines } = await promote(
    {
      tag: requireEnv('PROMOTE_TAG', process.env.PROMOTE_TAG),
      sha: requireEnv('PROMOTE_SHA', process.env.PROMOTE_SHA),
      selfWorkflowPath: resolveSelfWorkflowPath(process.env.GITHUB_WORKFLOW_REF),
    },
    {
      fetchJobs: async (sha) =>
        fetchWorkflowRunJobs(github, owner, repo, await fetchWorkflowRuns(github, owner, repo, sha)),
      compare: (tag, sha) => compareToTag(github, owner, repo, tag, sha),
      moveTag: (tag, sha) => moveTag(github, owner, repo, tag, sha),
    },
  );

  lines.forEach((line) => console.log(line));
  return exitCode;
}
