#173: a PR that deletes the `pull_request_target` workflow.

Scratch PR #249 (closed unmerged) deletes `.github/workflows/target-ref-probe.yml`
and nothing else. Its head commit `b9c53a0` carries `[skip ci]`. GitHub still ran
the copy on `main`: `pull_request_target` run 37770491746, job
`target ref refs/heads/main`, success. The PR's own tree decides nothing for a
target workflow, so deleting it there does not suppress the run.
