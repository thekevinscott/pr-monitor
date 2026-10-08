D19: on a stacked-mode hop, `branches:` is evaluated against the stack's
terminal target, not the immediate base (#167).

Head `31f8c7c`, base `probe/167-stack-base` (tip `ef3dcb2`, pr-monitor#244,
base `main`). `pr-monitor.yml` carries `branches: [main]`.

- First head `39f5640`, before the stack link: test merge `ebe137a` had first
  parent `ef3dcb2`, the base tip (normal mode). `pr-monitor.yml` did not run.
- Head `31f8c7c`, after the link: test merge `2cea5c4` has first parent
  `26333d7`, #244's own test merge (stacked mode). `CI Gate` ran (run
  37770145690).

The replay takes the whole walk: the preview parent differs from the base
tip, matches open #244's merge sha, so the target becomes `main`; the next hop
stops at `main`'s tip.

`target ref refs/heads/main` (run 37770142231) is `target-ref-probe.yml`
rendering `github.ref` on `pull_request_target`. It reads `refs/heads/main`
in both modes, so it is the default branch, not the PR base. willfire seeds
`refs/pull/245/merge` there, which is #149; this case's full check list stays
red until that lands.
