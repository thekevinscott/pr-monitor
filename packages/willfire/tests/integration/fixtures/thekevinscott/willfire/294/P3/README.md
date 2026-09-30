`[skip ci]` in the head commit message suppresses the dispatch.

`listWorkflows` was recorded on 2026-09-30, after the skip path began reading workflows; the list from when this case was captured was never recorded. It cannot change the verdict: under a skip instruction every `pull_request` workflow is no-dispatch, and the `pull_request_target` check reads the tree at the recorded merge sha.
