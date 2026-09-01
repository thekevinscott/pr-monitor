import { predict } from 'willfire';
import type { MonitorParams } from './types';
import { sleep } from './timing/sleep';
import { fetchWorkflowRunJobs } from './github/fetchWorkflowRunJobs';
import { fetchWorkflowRuns } from './github/fetchWorkflowRuns';
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

const POLL_INTERVAL_MS = 5_000;

/**
 * Gate on the set of check names willfire says this PR will produce: stay yellow
 * until every predicted name has reported and every predicted run has finished,
 * red if the observed set is not the predicted one.
 *
 * Runs still drive the wait, because a check name has no existence before the
 * run that creates its job. The verdict is made on names, which is the unit a
 * required status check keys on.
 *
 * There is no timeout — the backstop is the caller's own `timeout-minutes`.
 */
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

  // Shared with `reconcile`, so the second prediction is made under exactly the
  // options the first one was.
  const options = {
    // willfire builds a live sandboxed executor when this is omitted, so the
    // explicit null is what keeps execution off.
    executor: execute ? executor : null,
    action: resolveEventAction(context),
  };
  const prediction = await predict(predictClient, slug, pullNumber, options);
  let expected = expectedChecks(prediction, selfPath);
  const sha = resolveCommitSha(context);

  // A prediction with a hole in it cannot be compared against, and no amount of
  // polling fills the hole. Fail before the loop rather than after it.
  if (expected.unresolved.length > 0) {
    core.setFailed(formatUnresolvedFailure(expected.unresolved));
    return;
  }

  if (prediction.skip !== null) console.log(`Prediction: ${prediction.skip}`);
  console.log(`Monitoring workflow runs for commit: ${sha}`);
  // Provenance. A `uses:` tag can name a different program by the time this is
  // read, so the answer is only reconcilable if the commits behind it are named.
  console.log(`Prediction read from: ${formatSources(prediction.sources)}`);
  console.log(`Expected checks: ${JSON.stringify(expected.names)}`);
  console.log(`Expected runs: ${JSON.stringify(expected.workflows)}`);

  // At most one reconciliation per gate run. Trying again on every poll would be
  // a search for a prediction that agrees, which is the opposite of gating.
  let reconciled = false;

  while (true) {
    // Only pull_request runs are comparable to a PR prediction, and this
    // workflow is out of scope on both sides. Jobs are read from the surviving
    // runs only, so that filter covers the observed names too.
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
        // Judged against the same observation the divergence was found in. A
        // fresh fetch would move the target the decision was made about.
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
