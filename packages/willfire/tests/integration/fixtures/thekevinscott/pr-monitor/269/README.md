#266: a PR that makes the `pull_request_target` workflow unparseable.

Scratch PR #269 (closed unmerged) appends `  broken: [unclosed` to
`target-ref-probe.yml`, leaving its `on: pull_request_target` line alone. Its
head commit `0774c48` carries `[skip ci]`. GitHub still ran the copy on `main`
(`15f38b3`): `pull_request_target` run 37815126504, job
`target ref refs/heads/main`, success. Whether the PR's copy parses decides
nothing.
