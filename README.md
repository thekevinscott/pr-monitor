# PR Monitor

A GitHub Action that predicts which workflow runs a pull request will produce, then gates on exactly that set completing successfully. Use it as a single required check in branch protection instead of listing every workflow.

## Why?

Instead of maintaining a list of required checks that needs updating every time you add a workflow, use PR Monitor as your single required check.

The hard part of that job is knowing when everything has run. GitHub's dispatch decision is server-side and unpublished — no API tells you which workflows will fire for a PR after branch, path, and type filters. Earlier versions of this action guessed: sleep a while, require at least *N* runs to have appeared, give up after a timeout.

It no longer guesses. [willfire](https://github.com/thekevinscott/willfire) evaluates the repo's workflow files against the PR's base branch, changed files, and head commit, and returns the set of runs GitHub will create. The gate is then a set comparison:

- Stay yellow until every predicted run exists and has finished
- Go red if a predicted run finishes badly
- Go red if a run appears that nothing predicted — the prediction and reality disagree, so the gate cannot vouch for the check set

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

That is the whole surface. There is nothing to tune.

## How it works

1. Reads its own workflow path from `GITHUB_WORKFLOW_REF`, so it can exclude itself
2. Calls willfire's `predict()` for the PR, producing the entries GitHub should create
3. Reduces those entries to one set of workflow files: everything willfire does not call `no-dispatch`. Each must produce a run, and that run must finish
4. Polls `listWorkflowRunsForRepo` for the PR head commit every 5 seconds, keeping only `pull_request` runs
5. Fails immediately on any run outside that set
6. Waits while any required run is missing or any run is unfinished
7. Passes when every run concluded `success`, `skipped`, `neutral`, or `stale`; fails otherwise

A `[skip ci]` commit predicts nothing, so nothing is required and the gate passes.

## Why compare workflow runs, not check runs?

willfire predicts at job granularity, but the gate compares at workflow-run granularity. A workflow run stays non-terminal until *all* of its jobs finish — including `needs:`-gated jobs and reusable-workflow (`workflow_call`) children — so "the run finished" already means "every job finished," with no transient gaps to race against.

It also makes willfire's job-level `unknown` verdicts harmless. A matrix computed at runtime from another job's output cannot be expanded statically, but the run exists either way and still has to go green.

## Limitations

- **Workflows willfire does not model.** `workflow_run` chains and `pull_request_target` are not predicted, so their runs read as unexpected. If you use them, this gate is not for you yet.
- **The event action is inferred.** willfire derives `opened` vs `synchronize` from the PR's commit count rather than the actual event ([willfire#2](https://github.com/thekevinscott/willfire/issues/2)). If your workflows narrow `types:`, a wrong guess flips a dispatch verdict and reds a good build. Workflows with a bare `on: pull_request` are unaffected.
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
