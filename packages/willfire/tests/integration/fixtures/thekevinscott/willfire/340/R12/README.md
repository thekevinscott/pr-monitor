`probe-r12-caller.yml` invokes `probe-r12-r1.yml`, each reusable workflow
invokes the next through `probe-r12-r10.yml`, and `r10` runs the leaf: ten
reusable levels below the caller.

Dispatched at head `29a71da2972f4abafa0d2f88886841cd5ddef571`: run 36416635296
(`probe-r12-caller.yml`) succeeded with one check,
`root / hop / hop / hop / hop / hop / hop / hop / hop / hop / leaf`. Run
36416631687 (`pr-monitor.yml`) produced `CI Gate`, which failed because the
installed willfire of the day truncated at nine levels.

The documented nine-level limit does not bite at ten on GitHub.com. The
current source prediction agrees with the dispatched list.

`getCommit(main)` serves `4bba264`, main at dispatch. The original capture
read it hours later at `91aa0a8`, past `prt-noop.yml` landing on main 13 seconds
after the runs were created; no `pull_request_target` run fired here.
