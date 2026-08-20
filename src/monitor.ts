import { predict } from 'willfire';
import type { MonitorParams } from './types';
import { sleep } from './timing';
import {
  fetchWorkflowRuns,
  resolveCommitSha,
  resolvePullNumber,
  resolveSelfWorkflowPath,
} from './github';
import { compareRuns } from './checks';
import { expectedWorkflows } from './predict';
import { formatProgressLog, formatUnexpectedFailure, reportFinalResult } from './messages';

const POLL_INTERVAL_MS = 5_000;

/**
 * Gate on the set of workflow runs willfire says this PR will produce: stay
 * yellow until every predicted run exists and has finished, red if the observed
 * set is not the predicted one.
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
  const expected = expectedWorkflows(prediction, selfPath);
  const sha = resolveCommitSha(context);

  if (prediction.skip !== null) console.log(`Prediction: ${prediction.skip}`);
  console.log(`Monitoring workflow runs for commit: ${sha}`);
  console.log(`Required: ${JSON.stringify(expected.required)}`);

  while (true) {
    // Only pull_request runs are comparable to a PR prediction, and this
    // workflow is out of scope on both sides.
    const runs = (await fetchWorkflowRuns(github, owner, repo, sha)).filter(
      (r) => r.event === 'pull_request' && r.path !== selfPath,
    );
    const comparison = compareRuns(runs, expected);

    if (comparison.unexpected.length > 0) {
      core.setFailed(formatUnexpectedFailure(comparison.unexpected));
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
