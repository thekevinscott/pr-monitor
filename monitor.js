// Only these conclusions count as passing. Anything else completed
// (failure, cancelled, timed_out, action_required, stale, neutral)
// means the check did NOT pass and must fail the gate.
const PASSING_CONCLUSIONS = new Set(['success', 'skipped']);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async ({ github, context, core }) => {
  const PRE_SLEEP = parseInt(process.env.PRE_SLEEP) * 1000;
  const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) * 1000;
  const MAX_DURATION = parseInt(process.env.TIMEOUT) * 60 * 1000;
  const MINIMUM_CHECKS = parseInt(process.env.MINIMUM_CHECKS) || 0;

  const jobName = process.env.JOB_NAME;
  const userExcluded = process.env.EXCLUDED_JOBS
    ? process.env.EXCLUDED_JOBS.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const EXCLUDED_JOBS = [jobName, ...userExcluded];

  const { owner, repo } = context.repo;
  const commit_sha = context.payload.pull_request?.head?.sha || context.sha;

  console.log(`Sleeping ${Math.round(PRE_SLEEP / 1000)}s to allow other workflows to start`);
  await sleep(PRE_SLEEP);
  const start = performance.now();

  console.log(`Monitoring checks for commit: ${commit_sha}`);
  console.log(`Excluded jobs: ${JSON.stringify(EXCLUDED_JOBS)}`);

  async function fetchCheckRuns() {
    const response = await github.rest.checks.listForRef({
      owner,
      repo,
      ref: commit_sha,
      per_page: 100
    });
    return response.data.check_runs;
  }

  let checkRuns = await fetchCheckRuns();
  console.log('Found check runs:', checkRuns.map(r => r.name));

  let inProgressFound = [];
  let nonPassingFound = [];
  let relevantCount = 0;

  while (true) {
    inProgressFound = [];
    nonPassingFound = [];
    relevantCount = 0;

    for (const { name, status, conclusion } of checkRuns) {
      if (EXCLUDED_JOBS.includes(name)) continue;
      relevantCount++;

      if (status !== 'completed') {
        inProgressFound.push(name);
      } else if (!PASSING_CONCLUSIONS.has(conclusion)) {
        nonPassingFound.push(`${name} (${conclusion})`);
      }
    }

    const needsMore = relevantCount < MINIMUM_CHECKS;
    if (!inProgressFound.length && !needsMore) break;

    if (performance.now() - start > MAX_DURATION) {
      const mins = Math.round(MAX_DURATION / 1000 / 60);
      if (needsMore) {
        core.setFailed(`Timeout after ${mins} minutes. Only ${relevantCount}/${MINIMUM_CHECKS} required checks appeared.`);
      } else {
        core.setFailed(`Timeout after ${mins} minutes. Still in progress: ${JSON.stringify(inProgressFound)}`);
      }
      return;
    }

    const duration = Math.round((performance.now() - start) / 1000);
    const parts = [];
    if (needsMore) parts.push(`waiting for checks: ${relevantCount}/${MINIMUM_CHECKS}`);
    if (inProgressFound.length) parts.push(`in progress: ${JSON.stringify(inProgressFound)}`);
    console.log(`${parts.join(' | ')} | elapsed: ${duration}s`);

    await sleep(CHECK_INTERVAL);
    checkRuns = await fetchCheckRuns();
  }

  if (nonPassingFound.length) {
    core.setFailed(`Non-passing checks: ${JSON.stringify(nonPassingFound)}`);
  } else if (relevantCount === 0) {
    console.log('No other workflows to monitor (minimum-checks is 0) - treating as docs-only PR');
  } else {
    console.log(`All ${relevantCount} checks completed successfully`);
  }
};
