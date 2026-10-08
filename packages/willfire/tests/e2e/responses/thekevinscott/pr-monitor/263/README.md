#258: a PR that edits the `pull_request_target` trigger out of the workflow.

Scratch PR #263 (closed unmerged) changes `target-ref-probe.yml` to
`on: workflow_dispatch` under a `[skip ci]` head. GitHub ran the copy on `main`
anyway, run 37801008956: `target ref refs/heads/main`.

Like #248, the answer moves when `main` moves. Red here means
`target-ref-probe.yml` changed or left `main`.
