The runtime fan-out: matrices and job outputs computed by executing the
workflow's own steps, plus the only three-level reusable nesting. Red means
execution drifted or a moving tag moved.

Captured 2026-09-28 against head `2bd6b16138d374f71bffd72c2212e3b987d3208c`.
Ground truth: `repos/thekevinscott/putitoutthere/actions/runs?head_sha=2bd6b16138d374f71bffd72c2212e3b987d3208c&event=pull_request`, then each run's `/jobs` — 12 runs, 144 jobs, 144 unique names.

Re-recorded 2026-10-08 (#271): testing-conventions@v0 added the `workflow-lint` gate, adding `ci / Workflow lint (no logic in CI YAML)` and `engine / Workflow lint (no logic in CI YAML)`. Nothing else changed.
