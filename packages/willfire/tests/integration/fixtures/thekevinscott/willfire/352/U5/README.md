Two callers guard `uses: ./.github/workflows/probe-u5-callee.yml` with a
condition willfire cannot decide.

`secrets` is not an available context in a job-level `if:`, so GitHub rejected
`probe-u5.yml` at startup: the only run for it is a `push`-event run with
conclusion `failure` and zero jobs, dropped from the ground truth by the
event rule in the capture recipe. The shape issue #328 named for U5 is not a
valid workflow.

`vars` is available, so `probe-u5-vars.yml` is valid. The repository has no
`WILLFIRE_U5_ABSENT` variable, so `vars.WILLFIRE_U5_ABSENT != ''` was false and
GitHub skipped the call — dispatching a job named `callvars`, the caller, not
`callvars / inner`. Had the variable been set, the same file would have
dispatched `callvars / inner` and no `callvars`.

willfire predicts `callvars` since the caller keeps its own name when its
guard is undecided, and `prt-noop` since `pull_request_target` is modelled.

`listRepoVariables` was recorded on 2026-09-30, after the case first needed
it. That call takes no ref. The list holds only `RUN_EXTRA`, created
before this capture, and no `WILLFIRE_U5_ABSENT`, matching the run above.
