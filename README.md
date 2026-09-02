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
| `resolve-outputs` | Resolver commands, one per line; each becomes one willfire `--callback` | No | none |

That is the whole surface. There is nothing to tune.

**Execution is always on.** A matrix built from another job's outputs cannot be read into check names — willfire resolves it by running that job for real at the predicted commit and capturing what it writes to `$GITHUB_OUTPUT`. The job runs in willfire's hermetic docker sandbox: no network, no token, a read-only root, nothing kept. Code that can reach nothing and keep nothing needs no per-repo permission, which is why execution is default behavior rather than configuration — measured at ~1.3s marginal on a live PR. An execution that fails leaves the matrix unresolved, which is red.

**`resolve-outputs`** — for outputs the sandbox cannot compute (a job that needs tooling or network the sandbox denies), name resolver commands, one per line:

```yaml
- uses: thekevinscott/pr-monitor@v1
  with:
    resolve-outputs: |
      npx putitoutthere resolve
      npx testing-conventions resolve
```

Each line is trimmed, blank lines are dropped, and each survivor is forwarded to willfire as one `--callback "<command>"` — a command whose stdout is a JSON map answering job outputs ahead of execution ([willfire#153](https://github.com/thekevinscott/willfire/issues/153)). willfire ships that flag as of 0.1.47, so the input takes effect.

Each command runs from the workspace root — the same directory a `run:` step starts in — so write it against your repo the way you would write any other step.

The map is keyed by `owner/repo/.github/workflows/file.yml:job-id` — repo-qualified, no ref or sha, so one map answers wherever the workflow is reached from. Each key holds a list of `{ inputs, outputs }` entries, and an entry matches when every input it names equals the invocation's. Four parts of that contract bite:

- **Two lines cannot claim the same key.** willfire refuses the pair rather than merging them or picking one, and the prediction dies before it lists a single workflow. The gate fails with `'<key>' is answered by two callbacks: '<command a>' and '<command b>'`, naming both lines — every check in the repo goes unresolvable at once. Split the keys, or emit them from one resolver.
- **A claimed key that answers nothing is a failure, not a fallthrough.** A key your map never mentions still falls through to sandbox execution. A key it claims but cannot match for these inputs leaves the job's dependents `unknown` and fails the gate naming the job. Two entries under one key both matching is fatal to the whole prediction, like a duplicate key.
- **Matching sees only the inputs willfire settled.** An input it could not decide is left out rather than guessed, so an entry conditioned on one never matches. This is the quiet one — the entry reads correctly and simply never fires.
- **Resolvers get no GitHub credentials.** `GH_TOKEN` and `GITHUB_TOKEN` are deleted before the command runs. It runs outside the sandbox with the rest of the runner's environment, once per prediction, so a resolver that needs GitHub auth must carry its own token under another name.

## How it works

1. Reads its own workflow path from `GITHUB_WORKFLOW_REF`, so it can exclude itself
2. Calls willfire's `predict()` for the PR, producing the entries GitHub should create
3. Turns those entries into the expected set:
   - **check names** — every entry willfire can resolve to a name. Matrix legs expand, `name:` overrides apply, reusable-workflow callers prefix their children
   - **workflow files** — every workflow that will dispatch. Kept alongside the names because a run can conclude before it creates a single job: a `startup_failure` creates none, and a comparison made only of names cannot see it
   - **unresolvable entries** — a job willfire can see but cannot name. Fails immediately; see below
4. Polls `listWorkflowRunsForRepo` for the PR head commit every 5 seconds, keeping only `pull_request` runs, and reads each surviving run's jobs
5. Logs the commits the prediction was read from — the PR head, and every repo a `uses:` reached
6. Fails immediately on a run or a check name outside the expected set
7. Waits while a predicted run is missing or unfinished — a check name has no existence before the run that creates its job
8. Fails on a predicted check name that never reported once every run has finished
9. Passes when every run concluded `success`, `skipped`, `neutral`, or `stale`; fails otherwise

A `[skip ci]` commit predicts nothing, so nothing is required and the gate passes.

## Why check names, and why runs are still in the loop

A required status check keys on the **job's check name**, not the workflow file. Comparing workflow files is strictly coarser: a workflow can dispatch, go green, and produce a completely different set of jobs than predicted — a renamed job, a deleted one, a matrix that quietly stopped covering a combination — and a file-level comparison sees nothing wrong.

Runs still drive the waiting and the pass/fail conclusion. A run stays non-terminal until *all* of its jobs finish, including `needs:`-gated jobs and reusable-workflow (`workflow_call`) children, so "the run finished" already means "every job finished," with no transient gaps to race against. And a job's own conclusion is the wrong thing to judge: a `continue-on-error: true` job reports `failure` while its check reports green.

**Unresolvable check names.** A matrix computed at runtime from another job's output cannot be expanded statically, so willfire returns the job with no name. The gate fails and names it. That is deliberate: with a hole in the predicted set, a name that never reported is indistinguishable from a leg that was never predicted, and an extra name from a leg that was — so the gate cannot honour its contract. Nothing observed later settles it, so it fails up front rather than exempting the workflow and hiding real divergence inside it. In practice this arises when willfire's sandbox cannot run the job that computes the matrix — the execution failed, or the job needs something the sandbox denies.

**A callee tag that moved.** A `uses:` naming a moving tag — `owner/repo/.github/workflows/x.yml@v0` — can resolve to one commit when GitHub schedules the run and another when the gate predicts. The observed checks then come from one program and the predicted checks from another, with nothing wrong on either side.

So the gate records which commits each prediction was read from, and on divergence re-resolves those refs **once**. If any moved, it predicts again at the new commits and judges the same observation against the fresh expectation; the move is named in the log. If nothing moved, the divergence is real and stands — and no second prediction runs, so jobs are never executed twice to confirm a tag that held still. A move that still does not explain the observation is red, and so is a ref that stopped resolving: the gate will not vouch for a check set whose commits it cannot name.

## Limitations

- **Workflows willfire does not model.** `workflow_run` chains and `pull_request_target` are not predicted, so their runs read as unexpected. If you use them, this gate is not for you yet.
- **Dynamic matrices.** A `matrix:` built from another job's output cannot be expanded ahead of time. willfire runs the job that computes it in its sandbox; when that execution fails, the gate fails naming the job.
- **Event actions willfire does not model.** The gate hands willfire the real `pull_request` action when it is `opened`, `synchronize`, or `reopened`. Run it on any other type (`labeled`, `ready_for_review`, …) and willfire falls back to inferring the action from the PR's commit count ([willfire#2](https://github.com/thekevinscott/willfire/issues/2)), which can flip a dispatch verdict on workflows that narrow `types:`.
- **Over-prediction hangs.** A workflow predicted to dispatch that never does leaves the gate waiting for `timeout-minutes`. Reconciliation does not help here: it runs on divergence, and waiting is not divergence.
- **Reconciliation is a single attempt.** One re-resolve and at most one re-prediction per gate run. A tag that moves twice mid-flight, or moves after the reconciliation, stays red — repeating would be a search for a prediction that agrees rather than a gate on one.

## Upgrading from the check-count gate

`v1` rolls to `main`, so this arrives on merge. The inputs `job-name`, `excluded-jobs`, `pre-sleep`, `check-interval`, `timeout`, and `minimum-checks` are **removed** — every one of them existed to compensate for not knowing the expected run set. The `execute` input is removed too: execution is always on. Configs still passing any of them keep working; GitHub emits an "Unexpected input(s)" warning and ignores them.

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
