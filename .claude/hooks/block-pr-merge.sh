#!/usr/bin/env bash
# PreToolUse(Bash) guard for the merge policy in AGENTS.md: merge freely, except
# a PR that edits or removes an existing integration or e2e test needs Kevin's
# approval — an APPROVED review from thekevinscott on the PR's head commit.
#
# Exit 2 blocks the tool call and hands stderr back to the model. Any other
# non-zero exit is a hook error, which does NOT block — so every failure path
# below that matters must exit 2.
set -uo pipefail

REPO=thekevinscott/pr-monitor
APPROVER=thekevinscott
# Tests, the fixtures they assert against, and the gates that run them.
PROTECTED='(^|/)tests/(integration|e2e|fixtures)/|^\.github/workflows/|(^|/)testing-conventions\.toml$|(^|/)vitest[^/]*\.config\.[cm]?[jt]s$'

payload=$(cat)

if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')
else
  cmd=$payload
fi

deny() {
  echo "Blocked: $1" >&2
  exit 2
}

# Every merge goes through `gh pr merge` so the check below sees it.
if printf '%s' "$cmd" | grep -qE 'pulls/[0-9]+/merge'; then
  deny "the pulls/N/merge REST endpoint. Use gh pr merge <number>."
fi
if printf '%s' "$cmd" | grep -qE 'mergePullRequest|enablePullRequestAutoMerge'; then
  deny "a GraphQL merge mutation. Use gh pr merge <number>."
fi

merge_re='(^|[^[:alnum:]_./-])gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)'
printf '%s' "$cmd" | grep -qE "$merge_re" || exit 0

if [ "$(printf '%s' "$cmd" | grep -oE "$merge_re" | wc -l)" -ne 1 ]; then
  deny "more than one gh pr merge in one command. Merge one PR per call."
fi
# Arming checks the diff now and merges a later one.
if printf '%s' "$cmd" | grep -qE -- '--auto([[:space:]]|$)'; then
  deny "gh pr merge --auto. Merge directly once the PR is green."
fi
repo_arg=$(printf '%s' "$cmd" | grep -oE -- '(--repo|-R)[[:space:]=]+[^[:space:]]+' | sed -E 's/^(--repo|-R)[[:space:]=]+//')
if [ -n "$repo_arg" ] && [ "$repo_arg" != "$REPO" ]; then
  deny "a merge outside $REPO. This hook only knows this repo's policy."
fi
pr=$(printf '%s' "$cmd" | sed -nE 's#.*gh[[:space:]]+pr[[:space:]]+merge[[:space:]]+([^[:space:]]*/pull/)?([0-9]+)([[:space:]].*)?$#\2#p')
[ -n "$pr" ] || deny "gh pr merge without a PR number. Name it: gh pr merge <number>."

files=$(gh api "repos/$REPO/pulls/$pr/files" --paginate \
  --jq '.[] | select(.status != "added") | .filename, (.previous_filename // empty)') \
  || deny "could not list the files of #$pr, so the test-edit check cannot run."
touched=$(printf '%s\n' "$files" | grep -E "$PROTECTED" || true)
[ -n "$touched" ] || exit 0

head=$(gh api "repos/$REPO/pulls/$pr" --jq .head.sha) \
  || deny "could not read the head commit of #$pr."
approved=$(gh api "repos/$REPO/pulls/$pr/reviews" --paginate \
  --jq ".[] | select(.user.login == \"$APPROVER\" and .state == \"APPROVED\" and .commit_id == \"$head\") | .id") \
  || deny "could not read the reviews of #$pr."
[ -n "$approved" ] && exit 0

deny "#$pr edits or removes existing integration/e2e test files:
$touched
That needs Kevin's explicit approval: an approving review from $APPROVER on
the current head commit. Ask him; do not merge until it exists."
