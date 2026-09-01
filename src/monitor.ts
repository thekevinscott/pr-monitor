import { predict } from 'willfire';
import type { MonitorParams, WorkflowJobSummary, WorkflowRunSummary } from './types';
import { sleep } from './timing/sleep';
import { fetchWorkflowRunJobs } from './github/fetchWorkflowRunJobs';
import { fetchWorkflowRuns } from './github/fetchWorkflowRuns';
import { isRateLimited } from './github/isRateLimited';
import { resolveCommitSha } from './github/resolveCommitSha';
import { resolveEventAction } from './github/resolveEventAction';
import { resolvePullNumber } from './github/resolvePullNumber';
import { resolveSelfWorkflowPath } from './github/resolveSelfWorkflowPath';
import { compareObserved } from './checks/compareObserved';
import { describeDivergence } from './checks/describeDivergence';
import { expectedChecks } from './predict/expectedChecks';
import { reconcile } from './predict/reconcile';
import { formatProgressLog } from './messages/formatProgressLog';
import { formatSources } from './messages/formatSources';
import { formatUnresolvedFailure } from './messages/formatUnresolvedFailure';
import { reportFinalResult } from './messages/reportFinalResult';

const POLL_INTERVAL_MS = 30_000;
// Rate-limited reads don't cost quota to retry, so a fixed wait is cheap and needs no header math.
const RATE_LIMIT_RETRY_MS = 60_000;

export async function monitor({
  github,
  predictClient,
  context,
  core,
  execute,
  executor,
}: MonitorParams): Promise<void> {
  const { owner, repo } = context.repo;

  const selfPath = resolveSelfWorkflowPath(process.env.GITHUB_WORKFLOW_REF);
  if (selfPath === null) {
    core.setFailed('GITHUB_WORKFLOW_REF is unset or malformed; cannot identify this workflow');
    return;
  }

  const pullNumber = resolvePullNumber(context);
  if (pullNumber === null) {
    core.setFailed('pr-monitor gates a pull request; no pull_request payload on this event');
    return;
  }

  const slug = `${owner}/${repo}`;

  if (execute) {
    console.log(
      'Execution enabled by the execute input: every job this prediction reaches may run its steps for real.',
    );
  }

  const options = {
    // `null`, not omitted: willfire builds a live sandboxed executor by default.
    executor: execute ? executor : null,
    action: resolveEventAction(context),
  };
  const prediction = await predict(predictClient, slug, pullNumber, options);
  let expected = expectedChecks(prediction, selfPath);
  const sha = resolveCommitSha(context);

  if (expected.unresolved.length > 0) {
    core.setFailed(formatUnresolvedFailure(expected.unresolved));
    return;
  }

  if (prediction.skip !== null) console.log(`Prediction: ${prediction.skip}`);
  console.log(`Monitoring workflow runs for commit: ${sha}`);
  console.log(`Prediction read from: ${formatSources(prediction.sources)}`);
  console.log(`Expected checks: ${JSON.stringify(expected.names)}`);
  console.log(`Expected runs: ${JSON.stringify(expected.workflows)}`);

  let reconciled = false;

  while (true) {
    let runs: WorkflowRunSummary[];
    let jobs: WorkflowJobSummary[];
    try {
      runs = (await fetchWorkflowRuns(github, owner, repo, sha)).filter(
        (r) => r.event === 'pull_request' && r.path !== selfPath,
      );
      jobs = await fetchWorkflowRunJobs(github, owner, repo, runs);
    } catch (err) {
      if (!isRateLimited(err)) throw err;
      console.log(`GitHub API rate limited; retrying in ${RATE_LIMIT_RETRY_MS / 1000}s`);
      await sleep(RATE_LIMIT_RETRY_MS);
      continue;
    }
    let comparison = compareObserved(runs, jobs, expected);
    let divergence = describeDivergence(comparison);

    if (divergence !== null && !reconciled) {
      reconciled = true;
      const outcome = await reconcile({
        github: predictClient,
        slug,
        pullNumber,
        options,
        selfPath,
        sources: prediction.sources,
      });
      if (outcome.kind === 'failed') {
        core.setFailed(`${divergence} ${outcome.detail}`);
        return;
      }
      if (outcome.kind === 'repredicted') {
        console.log(outcome.detail);
        expected = outcome.expected;
        console.log(`Expected checks: ${JSON.stringify(expected.names)}`);
        console.log(`Expected runs: ${JSON.stringify(expected.workflows)}`);
        comparison = compareObserved(runs, jobs, expected);
        divergence = describeDivergence(comparison);
      }
    }

    if (divergence !== null) {
      core.setFailed(divergence);
      return;
    }
    if (comparison.missing.length === 0 && comparison.inProgress.length === 0) {
      reportFinalResult(comparison, {
        log: (msg) => console.log(msg),
        setFailed: (msg) => core.setFailed(msg),
      });
      return;
    }

    console.log(formatProgressLog(comparison));
    await sleep(POLL_INTERVAL_MS);
  }
}
