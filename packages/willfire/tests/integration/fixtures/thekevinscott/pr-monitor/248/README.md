#149: `github.ref` on a `pull_request_target` run.

Scratch PR #248 (closed unmerged) adds one file. Its head commit carries
`[skip ci]`, so the only run at head `09aa148` is `pull_request_target` run
37770250358 from `target-ref-probe.yml` on `main`, whose job name renders
`${{ github.ref }}`. GitHub named the check `target ref refs/heads/main`: the
default branch ref, not the `refs/pull/248/merge` the `pull_request` pass seeds.
