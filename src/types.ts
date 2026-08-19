import type * as Core from '@actions/core';
import type { context as GitHubContext } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils';

export type Octokit = InstanceType<typeof GitHub>;
export type GitHubContextType = typeof GitHubContext;
export type CoreModule = typeof Core;

export interface MonitorParams {
  github: Octokit;
  context: GitHubContextType;
  core: CoreModule;
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  /** Workflow file path, e.g. `.github/workflows/test.yml` — the key willfire predicts on. */
  path: string;
  /** Triggering event; only `pull_request` runs are comparable to a PR prediction. */
  event: string;
  status: string;
  conclusion: string | null;
}

export interface Classification {
  inProgress: string[];
  nonPassing: string[];
  relevantCount: number;
}

export interface Config {
  preSleepMs: number;
  checkIntervalMs: number;
  maxDurationMs: number;
  minimumChecks: number;
  excludedJobs: string[];
}
