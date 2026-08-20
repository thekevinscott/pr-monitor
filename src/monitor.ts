import { predict } from 'willfire';
import type { MonitorParams } from './types';
import { sleep } from './timing';
import {
  fetchWorkflowRunJobs,
  fetchWorkflowRuns,
  resolveCommitSha,
  resolvePullNumber,
  resolveSelfWorkflowPath,
} from './github';
import { compareObserved } from './checks';
import { expectedChecks } from './predict';
import {
  formatProgressLog,
  formatUnexpectedFailure,
  formatUnresolvedFailure,
  reportFinalResult,
} from './messages';

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
export async function monitor({ github, context, core }: MonitorParams): Promise<void> {
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

  const prediction = await predict(github, `${owner}/${repo}`, pullNumber);
  const expected = expectedChecks(prediction, selfPath);
  const sha = resolveCommitSha(context);

  // A prediction with a hole in it cannot be compared against, and no amount of
  // polling fills the hole. Fail before the loop rather than after it.
  if (expected.unresolved.length > 0) {
    core.setFailed(formatUnresolvedFailure(expected.unresolved));
    return;
  }

  if (prediction.skip !== null) console.log(`Prediction: ${prediction.skip}`);
  console.log(`Monitoring workflow runs for commit: ${sha}`);
  console.log(`Expected checks: ${JSON.stringify(expected.names)}`);
  console.log(`Expected runs: ${JSON.stringify(expected.workflows)}`);

  while (true) {
    // Only pull_request runs are comparable to a PR prediction, and this
    // workflow is out of scope on both sides. Jobs are read from the surviving
    // runs only, so that filter covers the observed names too.
    const runs = (await fetchWorkflowRuns(github, owner, repo, sha)).filter(
      (r) => r.event === 'pull_request' && r.path !== selfPath,
    );
    const jobs = await fetchWorkflowRunJobs(github, owner, repo, runs);
    const comparison = compareObserved(runs, jobs, expected);

    if (comparison.unexpected.length > 0 || comparison.unexpectedNames.length > 0) {
      core.setFailed(
        formatUnexpectedFailure(comparison.unexpected, comparison.unexpectedNames),
      );
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
