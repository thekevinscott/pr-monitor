# willrun — predict which GitHub Actions workflows a PR will dispatch

*Design doc for a proposed standalone open-source tool. `willrun` is a working name. This doc lives in pr-monitor for now because pr-monitor is its first consumer; the tool itself is an independent project. Supersedes the earlier "Workflow-Run Prediction: a deterministic merge gate" note (2026-08-15), which interleaved prediction with gate policy — this doc extracts the prediction half.*

## One-sentence contract

Given a repository state and a pull request, compute the set of workflow files GitHub Actions will dispatch for it — deterministically, with honest uncertainty.

```
willrun predict --repo owner/name --pr 123
```

```json
{
  "verdicts": [
    { "workflow": ".github/workflows/ci.yml",      "verdict": "dispatch",    "reasons": ["paths matched: src/lib.rs"] },
    { "workflow": ".github/workflows/docs.yml",     "verdict": "no-dispatch", "reasons": ["paths: no changed file matches docs/**"] },
    { "workflow": ".github/workflows/legacy.yml",   "verdict": "unknown",     "reasons": ["unrecognized trigger syntax at on.pull_request"] }
  ],
  "meta": { "changedFiles": 4, "diffTruncated": false, "skipInstruction": null }
}
```

## Why this tool should exist

A merge gate must answer "has everything that *should* run finished?" at a moment when it cannot see what *should* run. GitHub's dispatch decision — which workflows fire for a given PR, after branch/path/type filters — is made server-side and is not exposed by any API. There is no endpoint for "workflows considered but skipped." Every gate in the ecosystem therefore guesses:

- **Check-run counting** (Mergify-style): `#failures = 0` is vacuously true before anything dispatches; `#pending = 0` self-deadlocks; named anchors pend forever on path-filtered workflows.
- **Run polling with a wait** (pr-monitor's heuristic mode): sound, but the wait taxes exactly the PRs that should be fastest — a PR that triggers *zero* workflows pays the full pre-sleep before going green.

The ecosystem's existing tools all work the inverse direction: `dorny/paths-filter` and `tj-actions/changed-files` run *inside* an already-dispatched workflow. Systems that genuinely compute expected jobs from a diff (Prow/Tide `run_if_changed`, Zuul, GitLab `rules:changes`) can only do so because they own dispatch end to end. Nothing predicts GitHub's dispatcher from the outside.

**Why it's tractable now.** Predicting check-run *names* is undecidable in general (matrix expansion, reusable-workflow inner jobs, dynamic `fromJSON` matrices). But predicting which workflow *files* dispatch requires none of that — everything undecidable lives *inside* a run. What remains is static evaluation of `on.pull_request` triggers against the PR's base branch and changed-file list: documented semantics, with an existing OSS reference implementation of the pattern matcher (actionlint).

**Who consumes it:**

1. **Merge gates** (pr-monitor): gate on *expected ∪ observed* instead of sleeping and counting. A provably no-impact PR goes green immediately.
2. **Developers**: "what will CI run if I push this?" — locally, before pushing.
3. **Trigger-config validation**: "this workflow will never fire for PRs touching `src/`" as a lint, and — via a gate's over-prediction alarm — as a runtime check.

## Scope

### In scope

- Event: `pull_request` (the merge-gate case). Architecture should not preclude `push` later, but v1 is `pull_request` only.
- Per-workflow verdict: `dispatch` / `no-dispatch` / `unknown`, each with machine-readable reasons.
- Two modes: **fetch** (given `--repo`/`--pr`, pull everything needed from the GitHub API) and **pure** (all inputs supplied as JSON on stdin — no network, fully deterministic, what the test suite exercises).

### Non-goals (permanent, by design)

- **No check-run, job, or matrix prediction.** The run/check boundary is what makes this decidable. Requests to predict job names get a documented "no."
- **No gate behavior.** willrun never polls, never waits, never writes to GitHub. It is a pure question-answerer; timing and failure policy belong to consumers.
- **No fork / `pull_request_target` trust modeling.** Prediction treats these like any PR; the security semantics are the consumer's problem.

### The `unknown` verdict is a feature

The tool reimplements GitHub's semantics, so it will sometimes be unable to answer: unparseable YAML, trigger syntax it doesn't recognize, an oversized diff (below). It must say so per-workflow rather than guess, because consumers have real fallbacks — pr-monitor drops to its heuristic mode when any verdict is `unknown`. An honest `unknown` is strictly better than a confident wrong answer in either direction.

## Semantics to implement

The dispatch decision for `on.pull_request`, per GitHub's documented behavior:

| Rule | Behavior |
|---|---|
| Event present | No `pull_request` key under `on` → `no-dispatch`. |
| `types` | Defaults to `opened, synchronize, reopened`. The PR's triggering action must be in the list. |
| `branches` / `branches-ignore` | Evaluated against the PR's **base** branch. Mutually exclusive per event (both present → `unknown`). |
| `paths` / `paths-ignore` | Evaluated against the PR's changed-file list — the full base-to-head diff, same list the PR files API returns, **not** the head commit alone. Mutually exclusive per event. `paths`: at least one changed file must match. `paths-ignore`: dispatch unless *every* changed file matches. Zero changed files → path-filtered workflows do not dispatch. |
| Filter patterns | GitHub's filter-pattern grammar (`*`, `**`, `?`, `+`, `[...]`, `!` negation with order-sensitive semantics). actionlint's matcher is the reference implementation. |
| Combined filters | `branches` and `paths` on the same event must **both** match. |
| Skip instructions | `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]` in the head commit message (or a `skip-checks: true` trailer) suppress all `pull_request` workflows. Head commit message is therefore a required input. |
| Disabled workflows | A workflow with state `disabled_manually` / `disabled_inactivity` (Actions API) never dispatches, regardless of triggers. Fetch mode reads this; pure mode takes it as input. |
| Workflow file version | For `pull_request`, GitHub uses workflow files from the PR's **merge ref**, not the base branch. Fetch mode reads files at `refs/pull/N/merge` (falling back to head with a flagged caveat when the merge ref is unavailable, e.g. conflicts). |

### Open semantic questions (settle empirically, not by assertion)

- **Diffs over 300 files.** The earlier design note claimed oversized diffs cause path-filtered workflows to run regardless; GitHub's current docs read the opposite way — the evaluated diff is *truncated* at 300 files, so a matching file beyond the truncation means the workflow does **not** run. These imply opposite drift directions and cannot both be right. Until the probe suite (below) settles it: any PR whose changed-file count exceeds the documented limit gets `unknown` for every path-filtered workflow. `meta.diffTruncated` is set so consumers can log why they fell back.
- **Truncation ordering.** If the 300-file truncation is real, *which* 300 files are evaluated (and in what order) matters. Probe.
- **Invalid filter combinations** (`paths` + `paths-ignore` on one event). Does GitHub reject the workflow, ignore one filter, or something else? `unknown` until probed.

This list will grow. The rule is constant: a semantic the tool isn't sure of produces `unknown`, and every `unknown` reason is a candidate for a probe that converts it into a known rule.

## Interface

### CLI

```
# fetch mode: resolves inputs from the GitHub API (token from env)
willrun predict --repo owner/name --pr 123 [--json]

# pure mode: everything on stdin, no network — deterministic, replayable
willrun predict --stdin < inputs.json
```

Pure-mode input (also the fixture format for the entire test suite):

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

`changedFileCount` is separate from the list so the oversized-diff rule can apply even when a caller truncates the list.

### Library

A TypeScript package exporting the same pure function (`predict(inputs): Verdicts`) plus the fetch-mode input resolver as a separate module, so consumers like pr-monitor (a TS action) import the evaluator directly and reuse their own API clients.

### Language and the actionlint question

pr-monitor is TypeScript; actionlint (the pattern-matcher reference) is Go. Rather than FFI or shelling out to Go from a TS action, the plan is: **implement the matcher in TypeScript, and hold it to actionlint's behavior by differential testing** (verification layer 1 below). The filter-pattern grammar is small and documented; the risk is subtle divergence, which the differential harness exists to catch. A Go consumer could later wrap actionlint natively against the same fixture corpus — the pure-mode JSON contract is language-neutral by design.

## Verification: proving the predictor matches GitHub

This is the heart of the project. A predictor nobody has validated against reality is just a second implementation of the docs — and the docs, as the 300-file question shows, are not always right. Verification is layered, cheapest first, and the corpus formats are shared across layers.

### Layer 0 — spec fixtures (unit tests)

Table-driven pure-mode fixtures, one per documented rule and edge case: every filter type, default `types`, combined `branches`+`paths`, negation-pattern ordering, zero-changed-files, skip instructions, disabled workflows, unparseable YAML → `unknown`. Every example in GitHub's own docs becomes a fixture. This layer defines *intended* behavior; later layers check intent against reality.

### Layer 1 — differential pattern testing vs actionlint

The pattern matcher is the highest-risk reimplementation, and there's an oracle for it. A small harness feeds generated (pattern, path) pairs — both hand-written edge cases and property-based/fuzzed inputs — through the TS matcher and through actionlint's Go matcher, and fails on any disagreement. Runs in CI on every commit. This pins the grammar without pinning the whole tool to Go.

### Layer 2 — retrospective corpus replay (real repos, real PRs)

The main event: does the predictor agree with what GitHub actually did?

1. **Sample**: recent PRs (recent, so Actions retention hasn't deleted runs) from a diverse set of public repos — chosen to cover path filters, branch filters, monorepos, many-workflow repos. dirsql and pr-monitor itself are charter members.
2. **Reconstruct inputs**: workflow files at the merge ref, changed-file list from the PR files API, head commit message, workflow states → a pure-mode fixture. Fixtures are committed (or cached), so replay is offline and deterministic.
3. **Ground truth**: workflow runs for the PR's head SHA with `event=pull_request` from the Actions runs API.
4. **Score**: per-PR set comparison. Metrics: exact-set match rate; over-predictions (predicted, never ran) and under-predictions (ran, not predicted) counted separately — consumers care about the direction, since a gate is safe under one and not the other.
5. **Triage**: every mismatch gets classified — predictor bug, known ground-truth caveat, or *new semantic discovered* (which becomes a Layer 0 fixture and possibly a probe).

Known ground-truth caveats the harness must handle: runs deleted by retention (bound sample age), re-runs and `workflow_dispatch` runs on the same SHA (filter by event and take first run per workflow), fork PRs gated on first-contributor approval (runs may sit in `action_required` or not exist — exclude or bucket separately), and runs cancelled by `concurrency` (dispatch still happened; they count as ground-truth dispatches).

### Layer 3 — active probe repo (synthetic ground truth)

A dedicated public test repo containing a matrix of trigger configurations — one workflow per rule under test — plus a bot that opens synthetic PRs engineered to exercise each rule: a docs-only diff, a 301-file diff, a `[skip ci]` commit, a negation-pattern boundary case, an invalid `paths`+`paths-ignore` combo. The probe suite is how the open semantic questions above get *answers* instead of assumptions, and it's the only layer that can test rules real-world PRs rarely hit. Probes are re-runnable on demand and on a schedule.

### Layer 4 — shadow mode in a real consumer

Before any consumer *enforces* predictions, it runs them in shadow: pr-monitor keeps gating with its heuristics (`pre-sleep` + `minimum-checks`) while also computing the expected set and logging agreement — `predicted ∅, observed 2 runs` is a red flag that costs nobody a merge. dirsql, already running pr-monitor in heuristic mode, is the natural shadow deployment. Shadow telemetry is the graduation gate.

### Continuous regression

GitHub can change dispatch semantics without notice. Layers 1–3 re-run on a schedule (weekly), and a previously-passing probe or corpus fixture that starts failing pages the maintainers. The predictor's version declares the semantics-as-of date it was validated against.

### Graduation criteria (to "consumers may enforce")

- Layer 2: over four consecutive weekly runs, zero unexplained mismatches in either direction across the corpus; every explained mismatch has a fixture.
- Layer 3: all probes green, including probes for every formerly-open semantic question.
- Layer 4: N weeks of shadow agreement in at least one real repo with non-trivial path filtering.

## What this leaves for pr-monitor

pr-monitor's "expected-set mode" collapses to policy, with zero GitHub-semantics knowledge of its own:

1. Call willrun. Any `unknown` verdict → fall back to heuristic mode for this PR, and say so in the log.
2. Expected set **E** = the `dispatch` verdicts. **E = ∅ → exit green immediately** (no-impact PR; total latency = gate job boot).
3. Otherwise gate on **E ∪ observed**: green when every run in the union completes with a passing conclusion. No pre-sleep — the gate isn't guessing whether more runs are coming.
4. Drift posture is unchanged and direction-aware: **under-prediction is safe by construction** (observed runs are always waited on; E is a floor, never a ceiling). **Over-prediction fails loud** after a registration grace (~60–120s): `expected 'ci.yml' to dispatch for this diff; it did not` — an actionable red that doubles as runtime trigger-config validation.

The heuristics stay in pr-monitor permanently — as the fallback, not the default.

## References

- Predecessor note: "Workflow-Run Prediction: a deterministic merge gate" (2026-08-15); dirsql #943 (gate requirements; rejection of check-name prediction), #946, #948 (Mergify removal), #862 (trigger-config validation)
- [GitHub docs: workflow syntax — `on.pull_request` filters](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub docs: filter-pattern cheat sheet](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet)
- [GitHub docs: skipping workflow runs](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs)
- [GitHub docs: troubleshooting required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/troubleshooting-required-status-checks)
- [actionlint](https://github.com/rhysd/actionlint) — reference implementation of filter-pattern matching
- [dorny/paths-filter](https://github.com/dorny/paths-filter), [tj-actions/changed-files](https://github.com/marketplace/actions/changed-files) — inverse-direction tools
- Prow/Tide `run_if_changed`, Zuul, GitLab `rules:changes` — dispatch-owning systems where prediction is native
