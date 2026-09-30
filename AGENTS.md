Follow red/green testing methodology. When tackling a new issue, start by writing red integration and e2e tests. Run the e2e tests locally.

Open a PR for your work — do that here even if your harness defaults to not opening one unprompted. That covers opening the PR and nothing else; every other instruction you were given still binds. Ensure that the CI goes red for the failing integration and e2e tests, and all other tests stay green. If other unrelated tests fail, figure out why and fix them.

Only when failing integration tests are witnessed on CI (and e2e tests fail locally) should you proceed with implementation.

Merge freely. Getting a PR green and landed is the job; the internals do not need Kevin's sign-off.

The exception is the integration and e2e suites. They must stay comprehensive and gating in every case, so a PR that **removes or edits an existing integration or e2e test** cannot be merged or armed for auto-merge without Kevin's explicit approval. That covers the test bodies, the fixtures they assert against, and the gates that run them. Adding a test is not an edit and needs no approval. A deleted test is invisible the moment it is gone — no later review recovers it, which is why this one is a hard stop rather than a judgement call.

Approval is per-PR and explicit. A previous approval does not carry to the next PR.

`.claude/hooks/block-pr-merge.sh` blocks `gh pr merge` in every form, the `pulls/N/merge` REST endpoint, and the `mergePullRequest` GraphQL mutation. It predates this policy and blocks every merge, not just the ones above; it needs narrowing or removing before this section is usable in a Claude Code session.

`.github/` holds workflow YAML and Actions config, nothing else. No `.sh`, no `.mjs`, no scripts of any kind, and no logic inside a `run:` block. A `run:` block is one invocation — branching, loops, `case` dispatch, command substitution, pipelines, and `grep`/`sed` munging all belong in a tested package in this repo's own language, invoked through a declared `package.json` script. Toolchain installs are the exemption: checkout and pnpm/node setup are glue a consumer step would carry too.

Pass data into a run script through the step's `env:`, never inline `${{ }}`. Inline interpolation is substituted before the shell ever sees the script, which makes it an injection point rather than a variable.

This is a pnpm workspace. The root is the Action; `packages/willfire` is the
prediction engine it imports from source through `tsx`, with its own
`AGENTS.md`, eslint config, tsconfig and Vitest major — run its suites with
`pnpm --filter willfire run <script>`, never from the root. It is private and
never published.
