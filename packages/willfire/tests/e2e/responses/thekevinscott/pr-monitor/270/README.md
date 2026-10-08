#267: a PR whose non-default base holds a copy of the target workflow without
the trigger.

Scratch PR #270 (closed unmerged) targets a branch whose `target-ref-probe.yml`
says `on: workflow_dispatch`, under an empty `[skip ci]` head. GitHub ran the
copy on `main` anyway, run 37815150541: `target ref refs/heads/main`. The base
branch is deleted; the prediction does not need it.

Like #248 and #263, the answer moves when `main` moves. Red here means
`target-ref-probe.yml` changed or left `main`.
