Opened clean, dispatched runs 36430507327 (`probe-conflict-e.yml`) and 36430507309 (`pr-monitor.yml`), then took a conflicting commit on its base branch. `mergeable` flipped to `false` with both runs still attached, so an empty prediction was wrong for the whole remaining life of the PR. This is the case the `mergeable === false` early return got backwards.

The `pull_request_target` pass calls, at default-branch tip `91aa0a8c`, were recorded on 2026-10-01, after the target pass first needed them.
