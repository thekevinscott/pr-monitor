import { predict } from 'willfire';
import type { MonitorParams } from './types';
import { sleep } from './timing';
import {
  fetchWorkflowRunJobs,
  fetchWorkflowRuns,
  resolveCommitSha,
  resolveEventAction,
  resolvePullNumber,
  resolveSelfWorkflowPath,
} from './github';
import { compareObserved, describeDivergence } from './checks';
import { expectedChecks, reconcile } from './predict';
import {
  formatProgressLog,
  formatSources,
  formatUnresolvedFailure,
  reportFinalResult,
} from './messages';

const POLL_INTERVAL_MS = 5_000;

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
    const runs = (await fetchWorkflowRuns(github, owner, repo, sha)).filter(
      (r) => r.event === 'pull_request' && r.path !== selfPath,
    );
    const jobs = await fetchWorkflowRunJobs(github, owner, repo, runs);
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
