#173: a PR whose base predates the `pull_request_target` workflow.

Scratch PR #250 (closed unmerged) targets `probe/173-old-base`, a branch at
`b8eb1f9`, before `target-ref-probe.yml` landed on `main` in #233. Its head
`73ba5bc` is one empty `[skip ci]` commit, so the test merge has no target
workflow. GitHub ran the copy on `main` anyway: `pull_request_target` run
37770495867, job `target ref refs/heads/main`, success. `github.ref` is the
default branch, not the PR's base branch (#149).
