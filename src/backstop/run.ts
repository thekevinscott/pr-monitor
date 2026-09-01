import { Octokit } from '@octokit/rest';
import {
  MAX_COMMITS,
  compareToTag,
  fetchWorkflowRunJobs,
  fetchWorkflowRuns,
  listBranchCommits,
  moveTag,
  resolveSelfWorkflowPath,
} from '../github';
import { requireEnv } from '../promote/requireEnv';
import { backstop } from './backstop';
import { requireCount } from './requireCount';

// Composition root. No rule of its own.
export async function run(): Promise<number> {
  const github = new Octokit({ auth: requireEnv('GITHUB_TOKEN', process.env.GITHUB_TOKEN) });
  const owner = requireEnv('BACKSTOP_OWNER', process.env.BACKSTOP_OWNER);
  const repo = requireEnv('BACKSTOP_REPO', process.env.BACKSTOP_REPO);

  const { exitCode, lines } = await backstop(
    {
      tag: requireEnv('BACKSTOP_TAG', process.env.BACKSTOP_TAG),
      branch: requireEnv('BACKSTOP_BRANCH', process.env.BACKSTOP_BRANCH),
      depth: requireCount('BACKSTOP_DEPTH', process.env.BACKSTOP_DEPTH, MAX_COMMITS),
      maxDrift: requireCount('BACKSTOP_MAX_DRIFT', process.env.BACKSTOP_MAX_DRIFT, MAX_COMMITS),
      selfWorkflowPath: resolveSelfWorkflowPath(process.env.GITHUB_WORKFLOW_REF),
    },
    {
      listCommits: (branch, depth) => listBranchCommits(github, owner, repo, branch, depth),
      fetchJobs: async (sha) =>
        fetchWorkflowRunJobs(github, owner, repo, await fetchWorkflowRuns(github, owner, repo, sha)),
      compare: (tag, sha) => compareToTag(github, owner, repo, tag, sha),
      moveTag: (tag, sha) => moveTag(github, owner, repo, tag, sha),
    },
  );

  lines.forEach((line) => console.log(line));
  return exitCode;
}
