import type * as Core from '@actions/core';
import type { context as GitHubContext } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils';

type Octokit = InstanceType<typeof GitHub>;

export interface MonitorParams {
  github: Octokit;
  context: typeof GitHubContext;
  core: typeof Core;
}

// Only these conclusions count as passing. Anything else completed
// (failure, cancelled, timed_out, action_required, stale, neutral)
// means the check did NOT pass and must fail the gate.
const PASSING_CONCLUSIONS = new Set<string>(['success', 'skipped']);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function envInt(name: string, defaultValue: number): number {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function commitShaFor(context: typeof GitHubContext): string {
  const prSha = context.payload.pull_request?.head?.sha;
  if (typeof prSha === 'string') return prSha;
  return context.sha;
}

export async function monitor({ github, context, core }: MonitorParams): Promise<void> {
  const PRE_SLEEP = envInt('PRE_SLEEP', 0) * 1000;
  const CHECK_INTERVAL = envInt('CHECK_INTERVAL', 0) * 1000;
  const MAX_DURATION = envInt('TIMEOUT', 0) * 60 * 1000;
  const MINIMUM_CHECKS = envInt('MINIMUM_CHECKS', 0);

  const EXCLUDED_JOBS = [process.env.JOB_NAME ?? '', ...envList('EXCLUDED_JOBS')].filter(Boolean);

  const { owner, repo } = context.repo;
  const commit_sha = commitShaFor(context);

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
      per_page: 100,
    });
    return response.data.check_runs;
  }

  let checkRuns = await fetchCheckRuns();
  console.log('Found check runs:', checkRuns.map(r => r.name));

  let inProgressFound: string[] = [];
  let nonPassingFound: string[] = [];
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
      } else if (!PASSING_CONCLUSIONS.has(conclusion ?? '')) {
        nonPassingFound.push(`${name} (${conclusion})`);
      }
    }

    const needsMore = relevantCount < MINIMUM_CHECKS;
    if (inProgressFound.length === 0 && !needsMore) break;

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
    const parts: string[] = [];
    if (needsMore) parts.push(`waiting for checks: ${relevantCount}/${MINIMUM_CHECKS}`);
    if (inProgressFound.length > 0) parts.push(`in progress: ${JSON.stringify(inProgressFound)}`);
    console.log(`${parts.join(' | ')} | elapsed: ${duration}s`);

    await sleep(CHECK_INTERVAL);
    checkRuns = await fetchCheckRuns();
  }

  if (nonPassingFound.length > 0) {
    core.setFailed(`Non-passing checks: ${JSON.stringify(nonPassingFound)}`);
  } else if (relevantCount === 0) {
    console.log('No other workflows to monitor (minimum-checks is 0) - treating as docs-only PR');
  } else {
    console.log(`All ${relevantCount} checks completed successfully`);
  }
}
