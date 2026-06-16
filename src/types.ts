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
