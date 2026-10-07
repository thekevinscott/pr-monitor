D18: `branches:` on a single stacked hop is evaluated against the immediate
base, not the stack's terminal target (#167).

Head `795ab24`, base `probe/366-stack-base` (dirsql#1194, base `main`). Both
trees carry `probe-stack-branch-366.yml` with `branches: [main]`:

- dirsql#1194, base `main` — run 36438583967
- dirsql#1195, base `probe/366-stack-base` — no run

Only `CI Gate` (run 36438897464) dispatched on the child.

The child's test merge `d13b9fe` has first parent `84e3e3d`, the parent PR's
head, not the parent's test merge `2a99bcd`. So GitHub built it in normal mode,
not the stacked mode `stackTargetRef` was written for.

Recorded on 2026-10-07, after both PRs closed and the base branch was deleted:
`getCommit` at `probe/366-stack-base` answered 422, so the replay ends the
stack walk at its catch rather than at the base-tip comparison. No fixture yet
proves a stacked-mode hop.
