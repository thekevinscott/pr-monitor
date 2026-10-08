#258: a PR that edits the `pull_request_target` trigger out of the workflow.

Scratch PR #263 (closed unmerged) changes `target-ref-probe.yml` from
`on: pull_request_target` to `on: workflow_dispatch` and nothing else. Its head
commit `8982339` carries `[skip ci]`. GitHub still ran the copy on `main`:
`pull_request_target` run 37801008956, job `target ref refs/heads/main`,
success. The PR's own copy of a target workflow decides nothing, including
whether it triggers.
