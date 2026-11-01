#!/usr/bin/env bash
# check-clean.sh — run a whole-repo check with review-report/ moved aside.
#
# Filesystem-scanning linters (biome, prettier) see review-report/ even though
# git ignores it, so the skill's own artifact goes red in the repo's checks.
# The prescribed move-aside/restore dance got hand-run four times in one batch —
# so, like reset-workspace.sh, the procedure ships as a script.
#
#   check-clean.sh bun run check
#   check-clean.sh turbo run check-types
#
# The artifact is restored on ANY exit (trap), including a failing check, and
# the check's exit code passes through untouched.
#
# A running verify-skill instance owns review-report/verify/ for its evidence,
# so the check refuses while one is live. The instance's runtime state lives
# OUTSIDE review-report/, in the git dir (the layout create-verify-skill
# mandates), which is how this script can tell: its pid file is
# $(git rev-parse --git-dir)/verify/.pids. Field: a launch during a check
# recreated review-report/ and the restore nested the original inside it.
set -uo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: check-clean.sh <command> [args...]" >&2
  exit 2
fi

pids="$(git rev-parse --git-dir 2>/dev/null)/verify/.pids"
if [[ -s "$pids" ]]; then
  for pid in $(cat "$pids"); do
    if kill -0 "$pid" 2>/dev/null; then
      echo "check-clean: a verify-skill instance is running (pid $pid in $pids) — stop it with the verify skill's Cleanup first; the check did not run" >&2
      exit 2
    fi
  done
fi

moved=""
if [[ -d review-report ]]; then
  tmp="$(mktemp -d)" || exit 2
  moved="$tmp/review-report"
  if ! mv review-report "$moved"; then
    echo "check-clean: could not move review-report/ aside, so the check did not run" >&2
    exit 2
  fi
fi

restore() {
  local rc=$?
  if [[ -n "$moved" && -d "$moved" ]]; then
    if [[ -e review-report ]]; then
      echo "check-clean: review-report/ was recreated while the check ran, so the original was NOT restored — the check exited $rc; merge it back by hand from where it is left at $moved" >&2
      exit 2
    fi
    mv "$moved" review-report
  fi
  exit "$rc"
}
trap restore EXIT

"$@"
