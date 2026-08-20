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
  /** Workflow file path, e.g. `.github/workflows/test.yml`. */
  path: string;
  /** Triggering event; only `pull_request` runs are comparable to a PR prediction. */
  event: string;
  status: string;
  conclusion: string | null;
}

export interface WorkflowJobSummary {
  id: number;
  /**
   * The check name GitHub created for this job — matrix legs expanded, `name:`
   * overrides applied, reusable-workflow callers prefixed. This is the string
   * required status checks key on, and the observed side of the comparison.
   */
  name: string;
  /** Workflow file of the run that produced this job. */
  workflowPath: string;
  status: string;
  conclusion: string | null;
}

/** What willfire says this PR will produce. */
export interface ExpectedChecks {
  /** Check names that must report. */
  names: string[];
  /**
   * Workflow files that must produce a run. Kept alongside the names because a
   * run can conclude before it creates any job — `startup_failure` produces
   * none at all — so the names alone cannot see it.
   */
  workflows: string[];
  /**
   * Entries willfire sees but cannot resolve to a check name (a dynamic matrix).
   * The predicted set is incomplete while any of these exist, so the gate cannot
   * vouch for it and fails naming them.
   */
  unresolved: string[];
}

export interface GateComparison {
  /** Observed runs no prediction accounts for. */
  unexpected: string[];
  /** Observed check names no prediction accounts for, as `workflow :: name`. */
  unexpectedNames: string[];
  /** Predicted workflows with no run yet. */
  missing: string[];
  /** Predicted check names that have not reported. */
  missingNames: string[];
  /** Predicted check names that have reported. */
  matchedNames: string[];
  matched: string[];
  inProgress: string[];
  nonPassing: string[];
}
