import type * as Core from '@actions/core';
import type { context as GitHubContext } from '@actions/github';
import type { Octokit as RestOctokit } from '@octokit/rest';

/**
 * willfire's `predict` takes an `@octokit/rest` client, and the workflow-runs
 * endpoint is identical on it, so the action builds one client and uses it for
 * both the prediction and the poll.
 */
export type Octokit = RestOctokit;
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

/** The workflow files willfire says this PR will produce runs for. */
export interface ExpectedWorkflows {
  /**
   * Must appear and must finish. This is the whole set — divergence in either
   * direction is red, so there is no bucket of runs the gate merely permits.
   */
  required: string[];
}

export interface RunComparison {
  /** Observed runs no prediction accounts for — the gate cannot vouch for the set. */
  unexpected: string[];
  /** Required workflows with no run yet. */
  missing: string[];
  matched: string[];
  inProgress: string[];
  nonPassing: string[];
}
