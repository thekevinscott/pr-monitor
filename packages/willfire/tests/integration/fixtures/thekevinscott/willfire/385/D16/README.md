D16: `branches:` declining, and `branches-ignore:` at all, on a non-`main` base.

Three workflows, base `probe-base`, head `05fd712`:

- `b-main.yml`, `branches: [main]` — no run
- `b-probe.yml`, `branches: [probe-base]` — run 36430422967
- `bi-probe.yml`, `branches-ignore: [probe-base]` — no run

So a `branches:` missing the base declines, and a `branches-ignore:` covering
it declines. Both had only ever been a docs read: every earlier recording bases
on `main` and every captured `branches:` is `[main]` (#364).

Also dispatched: `CI Gate` (pr-monitor.yml) and `prt-noop`
(`pull_request_target`, read from the default branch, not the base: see
thekevinscott/pr-monitor#143).

`getCommit` for `main` and the target pass's calls were recorded on
2026-09-30, after the case first needed them. `main` had moved by then, but
its `prt-noop.yml` is the same blob (`b043948`) as at capture time.
