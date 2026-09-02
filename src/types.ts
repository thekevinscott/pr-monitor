import type * as Core from '@actions/core';
import type { context as GitHubContext } from '@actions/github';
import type { Octokit as RestOctokit } from '@octokit/rest';
import type { GithubClient, JobExecutor } from 'willfire';

export type Octokit = RestOctokit;
/** Not interchangeable with `Octokit`: hands back raw file text and unwrapped lists. */
export type PredictClient = GithubClient;
export type GitHubContextType = typeof GitHubContext;
export type CoreModule = typeof Core;

export interface MonitorParams {
  github: Octokit;
  predictClient: GithubClient;
  context: GitHubContextType;
  core: CoreModule;
  /** Test seam. Omitted in production, where willfire builds the live sandboxed executor. */
  executor?: JobExecutor;
  /** Resolver commands, forwarded to willfire one `--callback` each (willfire#153). */
  callbacks?: readonly string[];
}

export interface WorkflowRunSummary {
  id: number;
  name: string;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
}

export interface WorkflowJobSummary {
  id: number;
  name: string;
  workflowPath: string;
  status: string;
  conclusion: string | null;
}

export interface ExpectedChecks {
  names: string[];
  workflows: string[];
  unresolved: string[];
}

export interface GateComparison {
  unexpected: string[];
  unexpectedNames: string[];
  missing: string[];
  missingNames: string[];
  matchedNames: string[];
  matched: string[];
  inProgress: string[];
  nonPassing: string[];
}

export interface Decision {
  move: boolean;
  exitCode: number;
  lines: string[];
}
