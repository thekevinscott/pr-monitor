`probe-r12d-mixed.yml` has two jobs: `ok` calls `probe-r12c-h20.yml`, one
reusable level; `deep` calls `probe-r12c-h10.yml`, which chains through `h20`
for eleven levels.

Dispatched at head `6babf4ff6e9f0803cc0b9c8241bf87bc7aabab1d`: run 36417461106
(`probe-r12d-mixed.yml`) concluded `failure` with zero jobs and zero check
runs. The over-deep branch kills its legal sibling; the run's name falls back
to the workflow path. The other runs on the head are 36417458514
(`pr-monitor.yml`, `CI Gate`, failure) and 36417456232 (`prt-noop.yml`,
`pull_request_target`, success).

Earlier heads of the same PR measured 11 through 20 levels as single chains:
each failed the same way (runs 36417315398 through 36417314865). Those heads
are no longer the PR's, so only the mixed shape is replayable.

The current source prediction agrees: the mixed workflow collapses to a
workflow-level `run` with no job entries.
