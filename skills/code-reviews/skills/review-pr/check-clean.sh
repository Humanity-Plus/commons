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
set -uo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: check-clean.sh <command> [args...]" >&2
  exit 2
fi

moved=""
if [[ -d review-report ]]; then
  moved="$(mktemp -d)/review-report"
  mv review-report "$moved"
fi

restore() {
  if [[ -n "$moved" && -d "$moved" ]]; then
    mv "$moved" review-report
  fi
}
trap restore EXIT

"$@"
exit $?
