The canonical fleet shape: path filters, negations, three callers onto a moving tag. Red means the tag moved.

Captured 2026-09-26 against head `66f6b04edc10cf79ff953d16acd09f921273c2dd`.
Ground truth: `repos/thekevinscott/template-lib/actions/runs?head_sha=66f6b04edc10cf79ff953d16acd09f921273c2dd&event=pull_request`, then each run's `/jobs` — 54 jobs and 54 checks. "Build + smoke" is a job in both node.yml and rust.yml, so the name is listed twice.

Re-recorded 2026-10-08 (#271): testing-conventions@v0 added the `workflow-lint` gate, so each of the three callers gains `Workflow lint (no logic in CI YAML)`. Its detect step now reports Rust sources here, so the four `Rust / … (${{ matrix.language }})` jobs run and render as `(rust)`. Real-run cross-check: template-lib run 37044656824 (2026-10-02) shows the same `Rust / … (rust)` names.
