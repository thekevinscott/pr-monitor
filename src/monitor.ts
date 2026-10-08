import { willfire } from 'willfire';
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
import { isStalled } from './checks/isStalled';
import { latestRuns } from './checks/latestRuns';
import { executionDependent } from './predict/executionDependent';
import { expectedChecks } from './predict/expectedChecks';
import { reconcile } from './predict/reconcile';
import { formatNeverStarted } from './messages/formatNeverStarted';
import { formatProgressLog } from './messages/formatProgressLog';
import { formatSources } from './messages/formatSources';
import { formatUnresolvedFailure } from './messages/formatUnresolvedFailure';
import { reportFinalResult } from './messages/reportFinalResult';

const POLL_INTERVAL_MS = 30_000;
// Rate-limited reads don't cost quota to retry, so a fixed wait is cheap and needs no header math.
const RATE_LIMIT_RETRY_MS = 60_000;
// GitHub creates every run an event matches in the same second, so an absent run is not a slow
// one — this only covers the API being briefly inconsistent about a run it already created.
const STALL_GRACE_MS = 60_000;

export async function monitor({
  github,
  predictClient,
  context,
  core,
  executor,
  callbacks,
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

  const options = {
    // Undefined in production, so willfire builds its live sandboxed executor.
    executor,
    action: resolveEventAction(context),
    callbacks,
  };
  const prediction = await willfire(predictClient, slug, pullNumber, options);
  let expected = expectedChecks(prediction, selfPath);
  const sha = resolveCommitSha(context);

  if (expected.unresolved.length > 0) {
    core.setFailed(formatUnresolvedFailure(expected.unresolved, callbacks));
    return;
  }

  if (prediction.skip !== null) console.log(`Prediction: ${prediction.skip}`);
  console.log(`Monitoring workflow runs for commit: ${sha}`);
  console.log(`Prediction read from: ${formatSources(prediction.sources)}`);
  console.log(`Expected checks: ${JSON.stringify(expected.names)}`);
  console.log(`Expected runs: ${JSON.stringify(expected.workflows)}`);

  let current = prediction;
  let reconciled = false;
  let stalledPolls = 0;

  while (true) {
    let runs: WorkflowRunSummary[];
    let jobs: WorkflowJobSummary[];
    try {
      // Both events attach to the PR. A `push` run shares the head SHA without attaching, and
      // `merge_group` runs carry the queue's own commit, so neither reaches the comparison.
      const allRuns = await fetchWorkflowRuns(github, owner, repo, sha);
      if (expected.names.length === 0) {
        const pushRuns = allRuns.filter((r) => r.event === 'push' && r.path !== selfPath);
        if (pushRuns.length > 0) {
          core.setFailed(
            `No pull request checks were predicted, but push workflow runs exist for ${sha}: ` +
              `${pushRuns.map((r) => r.path).join(', ')}. Push-only CI is outside this PR gate.`,
          );
          return;
        }
      }
      runs = latestRuns(
        allRuns.filter(
          (r) =>
            (r.event === 'pull_request' || r.event === 'pull_request_target') &&
            r.path !== selfPath,
        ),
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
        current = outcome.prediction;
        expected = outcome.expected;
        console.log(`Expected checks: ${JSON.stringify(expected.names)}`);
        console.log(`Expected runs: ${JSON.stringify(expected.workflows)}`);
        comparison = compareObserved(runs, jobs, expected);
        divergence = describeDivergence(comparison);
      }
    }

    // An executed job's outputs are an answer for a run starting now. The run judged here already
    // computed its own, and a job reading mutable state (git tags) disagrees with it forever (#217).
    if (divergence !== null) {
      const unexecuted = await willfire(predictClient, slug, pullNumber, {
        action: options.action,
        executor: null,
      });
      const runLevel = executionDependent(current, unexecuted);
      if (runLevel.length > 0) {
        console.log(`Names depend on executed jobs; judged by run conclusion: ${JSON.stringify(runLevel)}`);
        expected = expectedChecks(current, selfPath, runLevel);
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

    if (isStalled(comparison)) {
      if (stalledPolls * POLL_INTERVAL_MS >= STALL_GRACE_MS) {
        core.setFailed(formatNeverStarted(comparison.missing, STALL_GRACE_MS));
        return;
      }
      stalledPolls++;
    } else {
      stalledPolls = 0;
    }

    console.log(formatProgressLog(comparison));
    await sleep(POLL_INTERVAL_MS);
  }
}
