#266: a PR that makes the `pull_request_target` workflow unparseable.

Scratch PR #269 (closed unmerged) breaks `target-ref-probe.yml`'s YAML under a
`[skip ci]` head. GitHub ran the copy on `main` anyway, run 37815126504:
`target ref refs/heads/main`.

Like #248 and #263, the answer moves when `main` moves. Red here means
`target-ref-probe.yml` changed or left `main`.
