#!/usr/bin/env bash
# reset-workspace.sh — review-pr Phase 0 workspace reset, as ONE atomic step.
# Field experience: the three-action prose instruction gets half-executed
# (lenses wiped, archive forgotten) — so the step ships as a script.
#
# Usage:  reset-workspace.sh [<current-target>]
#         <current-target> = the PR number, branch name, or head SHA this run
#         reviews. An existing findings.json is kept only when it describes the
#         checked-out HEAD and matches this target; anything else is stale.
#
#         "Describes HEAD" means meta.reviewedSha when the review recorded one
#         (a merge-forward review reads a merged tree), else meta.headSha.
#
# Actions, in order:
#   1. rm -rf review-report/lenses review-report/bundle
#                                            (per-run intermediates, never reused)
#   2. archive a MISMATCHED findings.json   -> findings-<its-pr-or-branch>.json
#      and the resolution.md that belongs to it -> resolution-<same label>.md
#      (archive, not delete: multi-PR chains file debt from the archive)
#   3. ensure review-report/ is git-ignored via the COMMON git dir's info/exclude
#      (worktree-safe; never touches .gitignore)
set -euo pipefail

target="${1:-}"
mkdir -p review-report
rm -rf review-report/lenses review-report/bundle
echo "✓ wiped review-report/lenses and review-report/bundle"

f="review-report/findings.json"
if [[ -f "$f" ]]; then
  pr="" sha="" head=""
  if command -v jq >/dev/null 2>&1; then
    pr="$(jq -r '.meta.prNumber // empty' "$f" 2>/dev/null || true)"
    # the commit the lenses read: a merge-forward review reads a merged tree,
    # so that — not the PR's pushed head — is what must equal HEAD
    sha="$(jq -r '.meta.reviewedSha // .meta.headSha // empty' "$f" 2>/dev/null || true)"
    head="$(jq -r '.meta.head // empty' "$f" 2>/dev/null || true)"
  fi
  current="$(git rev-parse HEAD 2>/dev/null || true)"
  match=0
  if [[ -n "$target" && -n "$sha" && "$current" == "$sha"* ]]; then
    for v in "$pr" "$sha" "$head"; do
      [[ -n "$v" && ( "$v" == "$target" || "$sha" == "$target"* ) ]] && match=1
    done
  fi
  if [[ $match -eq 1 ]]; then
    echo "✓ findings.json matches current target and HEAD — left in place"
  else
    label="${pr:+pr$pr}"
    label="${label:-${head//\//-}}"
    label="${label:-old}"
    mv "$f" "review-report/findings-${label}.json"
    echo "✓ archived stale findings.json → findings-${label}.json (it described: pr=${pr:-?} head=${head:-?} sha=${sha:0:7})"
    # the resolution log belongs to those findings and travels with them
    if [[ -f review-report/resolution.md ]]; then
      mv review-report/resolution.md "review-report/resolution-${label}.md"
      echo "✓ archived its resolution.md → resolution-${label}.md"
    fi
    # review-report/verify/ stays where it is: its dirs are keyed <phase>-<sha7>,
    # so runs never collide, and the archived findings/resolution record those
    # paths — moving the directory would dangle every evidence link.
  fi
fi

if [[ ! -f "$f" && -f review-report/resolution.md ]]; then
  mv review-report/resolution.md review-report/resolution-old.md
  echo "✓ archived an orphaned resolution.md → resolution-old.md"
fi

if ! git check-ignore -q review-report 2>/dev/null; then
  ex="$(git rev-parse --git-common-dir)/info/exclude"
  echo "review-report/" >>"$ex"
  echo "✓ added review-report/ to $ex"
fi
echo "✓ workspace ready"
