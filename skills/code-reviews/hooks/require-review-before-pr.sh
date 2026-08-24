#!/usr/bin/env bash
# require-review-before-pr.sh — Claude Code PreToolUse hook (matcher: Bash).
#
# Deterministically blocks `gh pr create` until a review-pr findings file exists
# that is NEWER than the last commit — i.e. the review actually saw the code being
# PR'd. The agent is told (via stderr, exit 2) to run /review-fix first; every
# other command passes through untouched.
#
# Install: see README.md in this directory.

set -euo pipefail

input="$(cat)"
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
else
  # Without jq, match against the raw hook payload — coarser, still effective.
  cmd="$input"
fi

# Only gate PR creation; everything else is allowed.
case "$cmd" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

findings="review-report/findings.json"
if [[ ! -f "$findings" ]]; then
  echo "Blocked: no $findings found. Run /review-fix (review-pr in findings-only mode, then resolve-review) and fix the findings before creating a PR." >&2
  exit 2
fi

# Fresh = newer than the last commit on this branch.
commit_ts="$(git log -1 --format=%ct 2>/dev/null || echo 0)"
if stat -f %m "$findings" >/dev/null 2>&1; then
  file_ts="$(stat -f %m "$findings")" # macOS
else
  file_ts="$(stat -c %Y "$findings")" # Linux
fi
if ((file_ts < commit_ts)); then
  echo "Blocked: $findings is older than the last commit. Re-run /review-fix so the review covers what you are about to PR." >&2
  exit 2
fi

exit 0
