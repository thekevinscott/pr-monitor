# PR Monitor

A GitHub Action that waits for all other workflow checks to complete and reports aggregate status. Use this as a single required check in branch protection rules instead of listing every workflow.

## Why?

Instead of maintaining a list of required checks that needs updating every time you add a workflow, use PR Monitor as your single required check. It will:

- Wait for all other workflow runs on the PR's head commit to complete
- Fail if any workflow run fails, is cancelled, or times out
- Pass only if every other workflow run finishes with a `success`, `skipped`, `neutral`, or `stale` conclusion
- Require at least N non-excluded workflow runs to have appeared (default `1`) so the gate can't pass before other workflows register
- Set `minimum-checks: 0` to allow docs-only PRs (no other workflow runs) to pass through

## Usage

Create `.github/workflows/pr-monitor.yml`:

```yaml
name: PR Monitor

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main

jobs:
  monitor:
    name: 'Check All Workflows'
    runs-on: ubuntu-latest
    steps:
      - uses: thekevinscott/pr-monitor@v1
```

Then set "Check All Workflows" as your only required check in branch protection. Keep this in its own workflow with no other jobs — the action excludes its own *workflow run*, so any sibling jobs in the same workflow would be skipped from monitoring.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `job-name` | Deprecated and optional. The action now excludes its own run via the run ID, so this is no longer needed. Retained for backward compatibility | No | `''` |
| `excluded-jobs` | Comma-separated workflow run names to exclude from monitoring | No | `''` |
| `pre-sleep` | Seconds to wait before checking | No | `10` |
| `check-interval` | Seconds between status checks | No | `5` |
| `timeout` | Maximum minutes to wait | No | `10` |
| `minimum-checks` | Minimum non-excluded workflow runs that must appear before declaring success. Default `1` prevents the gate from passing before other workflows register; set `0` to allow docs-only PRs (no other workflow runs) to pass | No | `1` |
| `github-token` | GitHub token for API access | No | `${{ github.token }}` |

## Example with exclusions

```yaml
jobs:
  monitor:
    name: 'PR Status'
    runs-on: ubuntu-latest
    steps:
      - uses: thekevinscott/pr-monitor@v1
        with:
          excluded-jobs: 'Deploy Preview,Notify Slack'
          timeout: '15'
```

## How it works

1. Waits `pre-sleep` seconds for other workflows to register
2. Polls the GitHub Actions API (`listWorkflowRunsForRepo`) for every workflow run on the PR's head commit, every `check-interval` seconds (paginating through all runs)
3. Excludes its own run (by run ID) and any workflows named in `excluded-jobs`
4. Waits until no workflow run is still queued or in progress
5. Fails if any completed run did not conclude `success`, `skipped`, `neutral`, or `stale`
6. Times out after `timeout` minutes if runs are still pending

## Why workflow runs, not check runs?

Earlier versions polled the **Checks API** and concluded the moment nothing was *currently* in progress. That races against the build: a `needs:`-gated job has no check run until its dependency finishes, and a fan-out larger than the runner pool registers its jobs in batches — so "nothing in progress right now" is not "everything has run," and the gate could go green before heavy jobs even started.

This version polls **workflow runs** instead. GitHub creates every workflow run for a commit within seconds of the push, and a run stays non-terminal until *all* of its jobs finish — including `needs:`-gated jobs and reusable-workflow (`workflow_call`) children. Waiting for "no run pending" therefore genuinely means "everything finished," with no transient gaps to race against, and it stays dynamic: a docs PR with one workflow waits for one run; a heavy PR waits for all of them.

> **Known limitation:** workflows triggered by `workflow_run` (i.e. chained *after* another workflow completes) are created late and may not be in the initial run list. This is a rare topology and is not covered.

## Upgrading

A recent `v1` release changed how the gate decides everything has finished: it now monitors **workflow runs** instead of individual check runs. If you pin `thekevinscott/pr-monitor@v1` you pick this up automatically — behaviour is the same in the common case (the gate goes green once everything else finishes) and strictly more correct under `needs:`-gated jobs and large fan-outs.

- `job-name` is **no longer required** — the action excludes its own run by run ID. Existing configs that still pass it keep working.
- `excluded-jobs` now matches **workflow run names** (the workflow's `name:`), not job names.
- Excluding by run ID means the gate excludes its *entire* workflow run. Keep the gate in a dedicated workflow (as shown above); if you add other jobs to that same workflow, they won't be monitored.

## Development

Source is TypeScript under `src/`, decomposed into one function per file. The action runs the TS directly via `tsx` (registered as a CommonJS hook at action invocation time) — no committed build artifact. Setup time (Node + `npm ci`) is subtracted from the configured `pre-sleep`, so when setup ≤ pre-sleep the perceived overhead is zero.

```sh
npm install
npm run verify   # typecheck + lint + tests (100% coverage required)
```

Individual scripts: `npm run typecheck`, `npm run lint`, `npm run test:coverage`.

CI enforces all three on every PR.

## License

MIT
