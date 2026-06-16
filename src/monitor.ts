import type { MonitorParams } from './types';
import { envInt } from './env';
import { sleep, computeRemainingPreSleep } from './timing';
import { readConfig } from './config';
import { resolveCommitSha, fetchWorkflowRuns } from './github';
import { classifyWorkflowRuns } from './checks';
import { formatProgressLog, formatTimeoutFailure, reportFinalResult } from './messages';

export async function monitor({ github, context, core }: MonitorParams): Promise<void> {
  const config = readConfig();
  const { owner, repo } = context.repo;
  const sha = resolveCommitSha(context);
  const selfRunId = context.runId;

  const actionStartMs = envInt('ACTION_START_MS', 0);
  const remainingPreSleep = computeRemainingPreSleep(config.preSleepMs, actionStartMs, Date.now());
  console.log(`Sleeping ${Math.round(remainingPreSleep / 1000)}s to allow other workflows to start`);
  await sleep(remainingPreSleep);
  const startMs = performance.now();

  console.log(`Monitoring workflow runs for commit: ${sha}`);
  console.log(`Excluded workflows: ${JSON.stringify(config.excludedJobs)}`);

  // Exclude this gate's own run; everything else on the SHA must finish.
  const fetch = async () =>
    (await fetchWorkflowRuns(github, owner, repo, sha)).filter((r) => r.id !== selfRunId);

  let runs = await fetch();
  console.log('Found workflow runs:', runs.map((r) => r.name));

  let classification = classifyWorkflowRuns(runs, config.excludedJobs);

  while (true) {
    const needsMore = classification.relevantCount < config.minimumChecks;
    if (classification.inProgress.length === 0 && !needsMore) break;

    if (performance.now() - startMs > config.maxDurationMs) {
      core.setFailed(
        formatTimeoutFailure({
          maxDurationMs: config.maxDurationMs,
          needsMore,
          relevantCount: classification.relevantCount,
          minimumChecks: config.minimumChecks,
          inProgress: classification.inProgress,
        }),
      );
      return;
    }

    const durationSec = Math.round((performance.now() - startMs) / 1000);
    console.log(
      formatProgressLog({
        inProgress: classification.inProgress,
        relevantCount: classification.relevantCount,
        minimumChecks: config.minimumChecks,
        durationSec,
      }),
    );

    await sleep(config.checkIntervalMs);
    runs = await fetch();
    classification = classifyWorkflowRuns(runs, config.excludedJobs);
  }

  reportFinalResult(classification, {
    log: (msg) => console.log(msg),
    setFailed: (msg) => core.setFailed(msg),
  });
}
