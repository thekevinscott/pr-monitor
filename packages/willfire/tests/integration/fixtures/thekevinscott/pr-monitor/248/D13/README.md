D13: a `pull_request_target` no-op on the default branch.

`target-ref-probe.yml` lives permanently on `main` and runs only `true`. A
workflow added in a PR's own tree never dispatches on `pull_request_target`,
so this shape cannot be built inside a scratch PR the way the other cases are.
The parent recording (`../calls.json`, `../fixture.json`) is the case: the
target run is the only run on head `09aa148`, so nothing else in the list can
mask it.
