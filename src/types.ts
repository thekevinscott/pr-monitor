import type * as Core from '@actions/core';
import type { context as GitHubContext } from '@actions/github';
import type { Octokit as RestOctokit } from '@octokit/rest';
import type { GithubClient, PredictOptions, Prediction } from 'willfire';

export type Octokit = RestOctokit;
/** Not interchangeable with `Octokit`: hands back raw file text and unwrapped lists. */
export type PredictClient = GithubClient;
export type GitHubContextType = typeof GitHubContext;
export type CoreModule = typeof Core;

/**
 * What the gate asks a prediction for. Narrower than willfire's own options by
 * one field: `executor` is a library seam the CLI has no flag for.
 */
export type PredictInputs = Pick<PredictOptions, 'action' | 'callbacks'>;

/** One willfire prediction. `run` wires the implementation that spawns the CLI. */
export type PredictPr = (
  slug: string,
  pullNumber: number,
  inputs: PredictInputs,
) => Promise<Prediction>;

export interface MonitorParams {
  github: Octokit;
  predictClient: GithubClient;
  predict: PredictPr;
  context: GitHubContextType;
  core: CoreModule;
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
