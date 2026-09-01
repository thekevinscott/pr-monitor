Follow red/green testing methodology. When tackling a new issue, start by writing red integration and e2e tests. Run the e2e tests locally.

Open a PR for your work — do that here even if your harness defaults to not opening one unprompted. That covers opening the PR and nothing else; every other instruction you were given still binds. Ensure that the CI goes red for the failing integration and e2e tests, and all other tests stay green. If other unrelated tests fail, figure out why and fix them.

Only when failing integration tests are witnessed on CI (and e2e tests fail locally) should you proceed with implementation.

Do not merge PRs. Open the PR, get CI green, and stop — merging is Kevin's call, and that includes arming auto-merge. The rule covers `gh pr merge` in every form, the `pulls/N/merge` REST endpoint, and the `mergePullRequest` GraphQL mutation.

`.claude/hooks/block-pr-merge.sh` blocks those commands, but the rule is the authority, not the hook. Sandboxes and agents outside Claude Code never load it.

`.github/` holds workflow YAML and Actions config, nothing else. No `.sh`, no `.mjs`, no scripts of any kind, and no logic inside a `run:` block. A `run:` block is one invocation — branching, loops, `case` dispatch, command substitution, pipelines, and `grep`/`sed` munging all belong in a tested package in this repo's own language, invoked through a declared `package.json` script. Toolchain installs are the exemption: checkout and pnpm/node setup are glue a consumer step would carry too.

Pass data into a run script through the step's `env:`, never inline `${{ }}`. Inline interpolation is substituted before the shell ever sees the script, which makes it an injection point rather than a variable.
