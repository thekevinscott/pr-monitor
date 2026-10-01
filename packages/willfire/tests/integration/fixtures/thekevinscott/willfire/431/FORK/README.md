A fork PR: what the fork-distinguishing contexts expand to, and which side of
the `head.repo.full_name == github.repository` guard runs.

Dispatched at head `c7a9dbc7c33e9cfa826fb60d3d4e6ea0af27019d`, all on `opened`:
runs 36436747976 (`fork-ctx.yml`), 36436747910 (`fork-guard.yml`), 36436748090
(`pr-monitor.yml`) and 36436747947 (`prt-noop.yml`, `pull_request_target`).

- `github.repository` is the base repo, `github.repository_owner` its owner.
- `github.actor` and `github.event.pull_request.head.repo.full_name` are the
  fork's.
- The same-repo job is `skipped` and still gets a check run; its negation runs.

First committed red by two under-predictions. `prt-noop` cleared with #356.
The four `fork-ctx` names, which read `github.*` beyond `github.event_name`
(willfire#437), cleared with
https://github.com/thekevinscott/pr-monitor/pull/148.

The head account has write access to the base repo, so the fork PR dispatched
immediately — no pending-approval state. That half of #327 stays uncovered.
