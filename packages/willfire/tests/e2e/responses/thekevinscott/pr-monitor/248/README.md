D13: the `pull_request_target` drift surface (#171).

A target workflow is read from the default branch tip at prediction time, not
from the frozen PR, so this is the one case whose answer moves when `main`
moves. Scratch PR #248 (closed unmerged) has a `[skip ci]` head, so the only
check is `target-ref-probe.yml`'s, run 37770250358: `target ref refs/heads/main`.

Red here means `target-ref-probe.yml` changed or left `main`, or GitHub moved
the target event's `github.ref`.
