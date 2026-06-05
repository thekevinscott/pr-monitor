# PR Monitor

A GitHub Action that waits for all other workflow checks to complete and reports aggregate status. Use this as a single required check in branch protection rules instead of listing every workflow.

## Why?

Instead of maintaining a list of required checks that needs updating every time you add a workflow, use PR Monitor as your single required check. It will:

- Wait for all other workflows to complete
- Fail if any workflow fails, is cancelled, or times out
- Pass only if all workflows finish with `success` or `skipped` conclusions
- Require at least N non-excluded checks to have appeared (default `1`) so the gate can't pass before other workflows register
- Set `minimum-checks: 0` to allow docs-only PRs (no other workflows) to pass through

## Usage

Create `.github/workflows/pr-monitor.yml`:

```yaml
name: PR Monitor

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main

jobs:
  monitor:
    name: 'Check All Workflows'
    runs-on: ubuntu-latest
    steps:
      - uses: clankerbot/pr-monitor@v1
        with:
          job-name: 'Check All Workflows'
```

Then set "Check All Workflows" as your only required check in branch protection.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `job-name` | Name of the job running this action (must match exactly) | **Yes** | - |
| `excluded-jobs` | Comma-separated additional job names to exclude | No | `''` |
| `pre-sleep` | Seconds to wait before checking | No | `10` |
| `check-interval` | Seconds between status checks | No | `5` |
| `timeout` | Maximum minutes to wait | No | `10` |
| `minimum-checks` | Minimum non-excluded check runs that must appear before declaring success. Default `1` prevents the gate from passing before other workflows register; set `0` to allow docs-only PRs (no other workflows) to pass | No | `1` |
| `github-token` | GitHub token for API access | No | `${{ github.token }}` |

## Example with exclusions

```yaml
jobs:
  monitor:
    name: 'PR Status'
    runs-on: ubuntu-latest
    steps:
      - uses: clankerbot/pr-monitor@v1
        with:
          job-name: 'PR Status'
          excluded-jobs: 'deploy-preview,notify-slack'
          timeout: '15'
```

## How it works

1. Waits `pre-sleep` seconds for other workflows to start
2. Polls the GitHub Checks API every `check-interval` seconds
3. Excludes itself (via `job-name`) and any jobs in `excluded-jobs`
4. Fails immediately if any check fails
5. Passes when all checks complete successfully
6. Times out after `timeout` minutes if checks are still running

## Important

The `job-name` input **must exactly match** the `name:` field of the job running this action. This is required because composite actions cannot automatically detect their parent job name.

## Development

Source is TypeScript under `src/`, decomposed into one function per file. The action runs the TS directly via `tsx` (registered as a CommonJS hook at action invocation time) — no committed build artifact. Setup time (Node + `npm ci`) is subtracted from the configured `pre-sleep`, so when setup ≤ pre-sleep the perceived overhead is zero.

```sh
npm install
npm run verify   # typecheck + lint + tests (100% coverage required)
```

Individual scripts: `npm run typecheck`, `npm run lint`, `npm run test:coverage`.

CI enforces all three on every PR.

## License

MIT
