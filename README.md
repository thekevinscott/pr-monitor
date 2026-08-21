# PR Monitor

A GitHub Action that predicts which checks a pull request will produce, then gates on exactly that set reporting and passing. Use it as a single required check in branch protection instead of listing every workflow.

## Why?

Instead of maintaining a list of required checks that needs updating every time you add a workflow, use PR Monitor as your single required check.

The hard part of that job is knowing when everything has run. GitHub's dispatch decision is server-side and unpublished — no API tells you which workflows will fire for a PR after branch, path, and type filters. Earlier versions of this action guessed: sleep a while, require at least *N* runs to have appeared, give up after a timeout.

It no longer guesses. [willfire](https://github.com/thekevinscott/willfire) evaluates the repo's workflow files against the PR's base branch, changed files, and head commit, and returns the set of check names GitHub will create. The gate is then a set comparison:

- Stay yellow until every predicted run exists and has finished
- Go red if a predicted run finishes badly
- Go red if a predicted check name never reports — a renamed job, a deleted one, or a matrix that stopped expanding to a combination
- Go red if a check name reports that nothing predicted — the prediction and reality disagree, so the gate cannot vouch for the check set

## Usage

Create `.github/workflows/pr-monitor.yml`:

```yaml
name: PR Monitor

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main

permissions:
  actions: read
  contents: read
  pull-requests: read

jobs:
  monitor:
    name: 'CI Gate'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: thekevinscott/pr-monitor@v1
```

Then set "CI Gate" as your only required check in branch protection.

The required-check context is the **job's `name:`**, not the workflow's. If you
rename the job, every open PR keeps reporting the old name until it gets a fresh
run — merge the base branch in, or push, to retrigger. GitHub does not
re-evaluate an existing run against the new requirement.

Keep this in its own workflow with no other jobs — the action excludes its own *workflow file* from both sides of the comparison, so any sibling jobs in that workflow go unmonitored.

**`permissions`** — if you set an explicit block, it needs all three of `actions: read`, `contents: read`, and `pull-requests: read`. The last one is new: willfire reads the PR and its changed files.

**`timeout-minutes`** — the action has no timeout of its own. This is the backstop. If a predicted run never dispatches, the gate waits until the job is killed.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | No | `${{ github.token }}` |
| `execute` | Jobs willfire may execute to resolve a dynamic matrix | No | `''` (nothing) |

That is the whole surface. There is nothing to tune — `execute` is a permission, not a knob.

**`execute`** — whitespace-separated grants of the form `owner/repo:job1,job2`, where `owner/repo` is the repo the workflow *file* lives in (for a reusable workflow, the callee):

```yaml
      - uses: thekevinscott/pr-monitor@v1
        with:
          execute: thekevinscott/testing-conventions:detect
```

A matrix built from another job's outputs cannot be read into check names — willfire resolves it by running that job for real at the predicted commit and capturing what it writes to `$GITHUB_OUTPUT`. Nothing runs without a grant, and a granted job runs the PR's version of itself, so grant only jobs whose code you trust under this gate. A malformed grant fails the gate immediately, named; an execution that fails leaves the matrix unresolved, which is also red.

## How it works

1. Reads its own workflow path from `GITHUB_WORKFLOW_REF`, so it can exclude itself
2. Calls willfire's `predict()` for the PR, producing the entries GitHub should create
3. Turns those entries into the expected set:
   - **check names** — every entry willfire can resolve to a name. Matrix legs expand, `name:` overrides apply, reusable-workflow callers prefix their children
   - **workflow files** — every workflow that will dispatch. Kept alongside the names because a run can conclude before it creates a single job: a `startup_failure` creates none, and a comparison made only of names cannot see it
   - **unresolvable entries** — a job willfire can see but cannot name. Fails immediately; see below
4. Polls `listWorkflowRunsForRepo` for the PR head commit every 5 seconds, keeping only `pull_request` runs, and reads each surviving run's jobs
5. Fails immediately on a run or a check name outside the expected set
6. Waits while a predicted run is missing or unfinished — a check name has no existence before the run that creates its job
7. Fails on a predicted check name that never reported once every run has finished
8. Passes when every run concluded `success`, `skipped`, `neutral`, or `stale`; fails otherwise

A `[skip ci]` commit predicts nothing, so nothing is required and the gate passes.

## Why check names, and why runs are still in the loop

A required status check keys on the **job's check name**, not the workflow file. Comparing workflow files is strictly coarser: a workflow can dispatch, go green, and produce a completely different set of jobs than predicted — a renamed job, a deleted one, a matrix that quietly stopped covering a combination — and a file-level comparison sees nothing wrong.

Runs still drive the waiting and the pass/fail conclusion. A run stays non-terminal until *all* of its jobs finish, including `needs:`-gated jobs and reusable-workflow (`workflow_call`) children, so "the run finished" already means "every job finished," with no transient gaps to race against. And a job's own conclusion is the wrong thing to judge: a `continue-on-error: true` job reports `failure` while its check reports green.

**Unresolvable check names.** A matrix computed at runtime from another job's output cannot be expanded statically, so willfire returns the job with no name. The gate fails and names it. That is deliberate: with a hole in the predicted set, a name that never reported is indistinguishable from a leg that was never predicted, and an extra name from a leg that was — so the gate cannot honour its contract. Nothing observed later settles it, so it fails up front rather than exempting the workflow and hiding real divergence inside it. Either give the job a statically expandable matrix, or grant execution of the job that computes it (the `execute` input above).

## Limitations

- **Workflows willfire does not model.** `workflow_run` chains and `pull_request_target` are not predicted, so their runs read as unexpected. If you use them, this gate is not for you yet.
- **Dynamic matrices.** A `matrix:` built from another job's output cannot be expanded ahead of time, so the gate fails naming the job — unless you grant execution of the job that computes it (the `execute` input).
- **Event actions willfire does not model.** The gate hands willfire the real `pull_request` action when it is `opened`, `synchronize`, or `reopened`. Run it on any other type (`labeled`, `ready_for_review`, …) and willfire falls back to inferring the action from the PR's commit count ([willfire#2](https://github.com/thekevinscott/willfire/issues/2)), which can flip a dispatch verdict on workflows that narrow `types:`.
- **Over-prediction hangs.** A workflow predicted to dispatch that never does leaves the gate waiting for `timeout-minutes`.

## Upgrading from the check-count gate

`v1` rolls to `main`, so this arrives on merge. The inputs `job-name`, `excluded-jobs`, `pre-sleep`, `check-interval`, `timeout`, and `minimum-checks` are **removed** — every one of them existed to compensate for not knowing the expected run set. Configs still passing them keep working; GitHub emits an "Unexpected input(s)" warning and ignores them.

Two things to do:

1. Add `pull-requests: read` to any explicit `permissions:` block
2. Add `timeout-minutes` to the gate job, replacing the old `timeout` input

`excluded-jobs` has no replacement. It existed to skip workflows the gate would otherwise wait on forever; the prediction now decides that, and excluding a workflow that genuinely dispatches would defeat the point of the gate.

## Development

Source is TypeScript under `src/`, decomposed into one function per file. The action runs the TS entrypoint directly with the `tsx` CLI (`tsx src/entry.ts`) — no build step and no committed build artifact. The package is ESM; willfire is ESM-only.

This project uses [pnpm](https://pnpm.io). With [Corepack](https://nodejs.org/api/corepack.html) enabled (`corepack enable`), the pinned version in `package.json`'s `packageManager` field is used automatically.

```sh
pnpm install
pnpm run verify   # typecheck + lint + tests (100% coverage required)
```

Individual scripts: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test:coverage`.

This repo dogfoods the action: [`.github/workflows/pr-monitor.yml`](.github/workflows/pr-monitor.yml) runs `./` as the `CI Gate` check against its own PRs.

To check a prediction by hand:

```sh
GH_TOKEN=... pnpm dlx willfire --repo thekevinscott/pr-monitor --pr 11 --json
```

CI enforces typecheck, lint, and coverage on every PR, plus a [testing-conventions](https://github.com/thekevinscott/testing-conventions) gate (colocated unit tests + 100% unit-suite coverage) run via its reusable workflow. The coverage floor and the reason-required exemptions live in `testing-conventions.toml`. Locally, `vitest.config.mts` extends the shared vitest config that `testing-conventions` publishes, so `pnpm run test:coverage` is held to the same floor.

## License

MIT
