#290: a reusable call gated on another reusable call's outputs.

`build-check.yml` calls `./.github/workflows/scope.yml` as `scope`, then
`build-check: needs: scope, if: needs.scope.outputs.scope == 'full'` calls the
external `thekevinscott/putitoutthere/.github/workflows/build.yml@v0`, which
nests `_matrix.yml@v0` (`plan`, then a runtime-matrix `build`). Deciding the
`if:` means running `scope.yml`'s `scope` job, whose step reads
`github.event.pull_request.base.sha` and `head.sha`, and lifting its result
through the callee's `on.workflow_call.outputs`.

Head `5bf7870`, test merge `11d6954`, seven `pull_request` runs. GitHub ran
`build-check / build / plan` and skipped `build-check / build / build`.
