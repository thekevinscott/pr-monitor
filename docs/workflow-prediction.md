# Handoff: workflow-dispatch prediction tool

*Design brief for a new standalone open-source project. Working name: `willrun`. This file seeds the new repo; it lives in pr-monitor only because pr-monitor is the first consumer.*

## What to build

A tool that takes a **repo + pull request** and computes the **set of workflows GitHub Actions will dispatch** for it — plus a harness that tests the prediction against what GitHub *actually* dispatches.

No API exposes this: GitHub's dispatch decision (which workflow files fire after branch/path/type filters) is server-side and unpublished. Existing tools work the inverse direction, inside already-running workflows. The prediction is tractable because the target is workflow **files**, not check-runs or jobs — everything undecidable (matrix expansion, reusable workflows, dynamic names) lives *inside* a run and drops out. What remains is static evaluation of `on.pull_request` triggers against the PR's base branch and changed files.

## Contract

```
willrun predict --repo owner/name --pr 123        # fetch mode: resolves inputs via GitHub API
willrun predict --stdin < inputs.json             # pure mode: no network, deterministic
```

Output — a verdict per workflow file, never a bare set:

```json
{
  "verdicts": [
    { "workflow": ".github/workflows/ci.yml",   "verdict": "dispatch",    "reasons": ["paths matched: src/lib.rs"] },
    { "workflow": ".github/workflows/docs.yml", "verdict": "no-dispatch", "reasons": ["no changed file matches docs/**"] },
    { "workflow": ".github/workflows/old.yml",  "verdict": "unknown",     "reasons": ["unrecognized trigger syntax"] }
  ],
  "meta": { "changedFileCount": 4, "diffTruncated": false, "skipInstruction": null }
}
```

**`unknown` is a first-class verdict, not an error.** Unparseable YAML, unrecognized syntax, oversized diffs → say so per-workflow instead of guessing. Consumers have real fallbacks (pr-monitor drops to its heuristic mode); a confident wrong answer in either direction is worse than an honest `unknown`.

Pure-mode input doubles as the fixture format for the whole test suite:

```json
{
  "workflows": [ { "path": ".github/workflows/ci.yml", "content": "…", "state": "active" } ],
  "event": { "type": "pull_request", "action": "synchronize" },
  "baseRef": "main",
  "changedFiles": ["src/lib.rs", "README.md"],
  "changedFileCount": 2,
  "headCommitMessage": "fix: handle empty input"
}
```

Ship it as a TypeScript library (pure `predict(inputs)` + a separate fetch-mode input resolver) with a thin CLI. The stdin/JSON contract keeps it language-neutral for non-TS consumers.

## Semantics to implement

| Rule | Behavior |
|---|---|
| Event present | No `pull_request` under `on` → `no-dispatch`. |
| `types` | Default `opened, synchronize, reopened`; PR's action must be listed. |
| `branches(-ignore)` | Matched against the PR's **base** branch. |
| `paths(-ignore)` | Matched against the full base-to-head changed-file list (same as the PR files API), not the head commit. `paths`: ≥1 file must match. `paths-ignore`: dispatch unless *all* files match. Zero changed files → no dispatch for path-filtered workflows. |
| Pattern grammar | GitHub filter patterns (`*`, `**`, `?`, `+`, `[...]`, order-sensitive `!` negation). actionlint is the reference implementation. |
| Combined filters | `branches` + `paths` on one event must both match. |
| Skip instructions | `[skip ci]` / `[ci skip]` / `[no ci]` / `[skip actions]` / `[actions skip]` or `skip-checks` trailer in the head commit message suppresses all `pull_request` workflows — head commit message is a required input. |
| Disabled workflows | `disabled_manually` / `disabled_inactivity` state → never dispatches. |
| File version | For `pull_request`, GitHub reads workflow files from the PR's **merge ref**; fetch from `refs/pull/N/merge`, fall back to head with a flagged caveat. |

**Open questions — return `unknown`, resolve empirically via the harness:**

- **>300-file diffs.** Docs say the evaluated diff is truncated at 300 files (a match beyond it does **not** run); prior notes claimed the opposite (oversized diffs run everything). Opposite drift directions — settle by probe, not assertion.
- Truncation ordering (which 300 files?), and behavior of invalid combos (`paths` + `paths-ignore` on one event).

**Non-goals (permanent):** predicting check-runs/jobs/matrices; any gate behavior (no polling, no waiting, no GitHub writes); fork/`pull_request_target` trust modeling. v1 is `pull_request` only.

## Verification: testing against what GitHub actually does

This is half the project. Layered, cheapest first; all layers share the pure-mode fixture format.

1. **Spec fixtures.** Table-driven pure-mode tests, one per rule above; every example in GitHub's docs becomes a fixture. Defines *intended* behavior.
2. **Differential pattern testing vs actionlint.** The glob matcher is the riskiest reimplementation and the one piece with an oracle. Feed hand-written + fuzzed (pattern, path) pairs through the TS matcher and actionlint's Go matcher; any disagreement fails CI.
3. **Retrospective corpus replay.** Sample recent PRs from diverse public repos (recent, so Actions retention hasn't deleted runs). Reconstruct pure-mode inputs (workflow files at merge ref, PR files API, head commit message, workflow states) and commit them as fixtures. Ground truth = workflow runs for the head SHA with `event=pull_request`. Score per-PR set agreement; count **over-predictions** (predicted, never ran) and **under-predictions** (ran, not predicted) separately — consumers only fear one direction. Triage every mismatch: predictor bug, ground-truth caveat (re-runs, fork approval gates, concurrency-cancelled runs — those still count as dispatches), or a newly discovered semantic → new fixture.
4. **Active probe repo.** A dedicated public repo with one workflow per rule under test, plus a bot opening synthetic PRs engineered to hit cases real PRs rarely do: docs-only diff, 301-file diff, `[skip ci]`, negation boundaries, invalid filter combos. This is what converts the open questions into answers.
5. **Continuous regression.** Layers 2–4 re-run weekly; a previously-passing fixture or probe that starts failing = GitHub changed semantics — alert. Releases declare the semantics-as-of date they were validated against.

**Done means:** across consecutive weekly corpus runs, zero unexplained mismatches in either direction; all probes green, including one per formerly-open question.

## First consumer (context, not scope)

pr-monitor (TypeScript GitHub Action) will call this and gate on *expected ∪ observed*: empty expected set → green immediately (~25s instead of ~60s for no-impact PRs); any `unknown` → fall back to its current heuristics; expected-but-never-dispatched → loud failure after a grace period. All of that is pr-monitor's policy — this tool just answers the question. Recommended rollout there is shadow mode first (predict + log agreement while the heuristics still gate).

## Milestones

1. Parser + trigger evaluator + TS pattern matcher; spec fixtures (layer 1 differential harness alongside).
2. Fetch-mode input resolver + CLI.
3. Corpus replay harness + first mismatch triage.
4. Probe repo + bot; resolve the >300-file question and other unknowns.
5. Weekly regression automation; cut v1; pr-monitor shadow-mode integration.

## References

- [Workflow syntax: `on.pull_request` filters](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions) · [filter-pattern cheat sheet](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet) · [skipping workflow runs](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs)
- [actionlint](https://github.com/rhysd/actionlint) — reference filter-pattern matcher
- [dorny/paths-filter](https://github.com/dorny/paths-filter), [tj-actions/changed-files](https://github.com/marketplace/actions/changed-files) — inverse-direction prior art
- Prow/Tide `run_if_changed`, Zuul, GitLab `rules:changes` — dispatch-owning systems where prediction is native
- Predecessor discussion: dirsql #943/#946/#948 (Mergify removal, rejection of check-name prediction), #862 (trigger-config validation)
