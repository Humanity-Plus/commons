#!/usr/bin/env bash
# reset-workspace.sh — review-pr Phase 0 workspace reset, as ONE atomic step.
# Field experience: the three-action prose instruction gets half-executed
# (lenses wiped, archive forgotten) — so the step ships as a script.
#
# Usage:  reset-workspace.sh [<current-target>]
#         <current-target> = the PR number, branch name, or head SHA this run
#         reviews; used to decide whether an existing findings.json is stale.
#
# Actions, in order:
#   1. rm -rf review-report/lenses          (per-run intermediates, never reused)
#   2. archive a MISMATCHED findings.json   -> findings-<its-pr-or-branch>.json
#      (archive, not delete: multi-PR chains file debt from the archive)
#   3. ensure review-report/ is git-ignored via the COMMON git dir's info/exclude
#      (worktree-safe; never touches .gitignore)
set -euo pipefail

target="${1:-}"
mkdir -p review-report
rm -rf review-report/lenses
echo "✓ wiped review-report/lenses"

f="review-report/findings.json"
if [[ -f "$f" ]]; then
  pr="" sha="" head=""
  if command -v jq >/dev/null 2>&1; then
    pr="$(jq -r '.meta.prNumber // empty' "$f" 2>/dev/null || true)"
    sha="$(jq -r '.meta.headSha // empty' "$f" 2>/dev/null || true)"
    head="$(jq -r '.meta.head // empty' "$f" 2>/dev/null || true)"
  fi
  match=0
  if [[ -n "$target" ]]; then
    for v in "$pr" "$sha" "$head"; do
      [[ -n "$v" && ( "$v" == "$target" || "$sha" == "$target"* ) ]] && match=1
    done
  fi
  if [[ $match -eq 1 ]]; then
    echo "✓ findings.json matches current target — left in place"
  else
    label="${pr:+pr$pr}"
    label="${label:-${head//\//-}}"
    label="${label:-old}"
    mv "$f" "review-report/findings-${label}.json"
    echo "✓ archived stale findings.json → findings-${label}.json (it described: pr=${pr:-?} head=${head:-?})"
  fi
fi

if ! git check-ignore -q review-report 2>/dev/null; then
  ex="$(git rev-parse --git-common-dir)/info/exclude"
  echo "review-report/" >>"$ex"
  echo "✓ added review-report/ to $ex"
fi
echo "✓ workspace ready"
