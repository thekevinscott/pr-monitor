#267: a PR whose non-default base holds a copy of the target workflow without
the trigger.

Scratch PR #270 (closed unmerged) targets `probe/267-base` (`dd78e80`), which
changes `target-ref-probe.yml` to `on: workflow_dispatch`. `main` (`15f38b3`)
keeps `on: pull_request_target`. The head `de366c6` is an empty `[skip ci]`
commit, so the PR's diff touches nothing. GitHub ran the copy on `main`:
`pull_request_target` run 37815150541, job `target ref refs/heads/main`,
success.
