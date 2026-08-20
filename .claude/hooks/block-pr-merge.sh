#!/usr/bin/env bash
# PreToolUse(Bash) guard: agents do not merge pull requests here.
#
# Open the PR, get CI green, stop. The merge is a human decision.
#
# Exit 2 blocks the tool call and hands stderr back to the model. Any other
# non-zero exit is a hook error, which does NOT block — so every failure path
# below that matters must exit 2.
set -uo pipefail

payload=$(cat)

if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
else
  # No jq: match the raw payload instead. Closed on the patterns below, open
  # on everything else — a missing jq must not block every Bash call.
  cmd=$payload
fi

deny() {
  {
    echo "Blocked: $1"
    echo
    echo "This repo does not let agents merge pull requests. Open the PR, get CI"
    echo "green, and stop. Ask the repo owner to merge."
  } >&2
  exit 2
}

# `gh pr merge` in any form, anywhere in the command — after ';', '&&', '|', or
# inside a subshell. Covers --auto, --squash, --admin, --rebase alike: arming
# auto-merge is still deciding to merge.
if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_./-])gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)'; then
  deny "gh pr merge"
fi

# REST: PUT /repos/{owner}/{repo}/pulls/{number}/merge
if printf '%s' "$cmd" | grep -qE 'pulls/[0-9]+/merge'; then
  deny "the pulls/N/merge REST endpoint"
fi

# GraphQL mutations that merge or arm a merge.
if printf '%s' "$cmd" | grep -qE 'mergePullRequest|enablePullRequestAutoMerge'; then
  deny "a GraphQL merge mutation"
fi

exit 0
