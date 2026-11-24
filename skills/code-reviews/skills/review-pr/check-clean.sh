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
# the check's exit code passes through untouched — with two exceptions, both
# things a green check would otherwise hide:
#
#   exit 3  the check passed but changed the working tree (git status differs
#           from before it ran): a committed generated file is stale, or the
#           "check" rewrites files. Field: a stale api.d.ts no lens could see.
#   exit 2  the script could not do its own job (see the messages below).
#
# Files written into review-report/ WHILE the check ran (a lens finishing late)
# are merged into the restored original; only a path that exists on both sides
# stops the restore. Better still: run no whole-repo check while lenses are in
# flight. Field: the earlier fail-on-any-recreation stranded finished work in a
# temp folder and exited non-zero for a check that had passed.
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

# What git sees before the check, to compare with what it sees after.
tracked="" before=""
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked=1
  before="$(git status --porcelain 2>/dev/null)"
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
      local clash="" f
      if [[ -d review-report ]]; then
        while IFS= read -r -d '' f; do
          if [[ -e "$moved/${f#review-report/}" ]]; then clash="${f#review-report/}"; break; fi
        done < <(find review-report -type f -print0)
      else
        clash="review-report (recreated as a file)"
      fi
      if [[ -n "$clash" ]]; then
        echo "check-clean: review-report/ was recreated while the check ran and '$clash' exists on both sides, so the original was NOT restored — the check exited $rc; merge it back by hand from where it is left at $moved" >&2
        exit 2
      fi
      while IFS= read -r -d '' f; do
        mkdir -p "$moved/$(dirname "${f#review-report/}")"
        mv "$f" "$moved/${f#review-report/}"
      done < <(find review-report -type f -print0)
      rm -rf review-report
      echo "check-clean: files written to review-report/ while the check ran were merged into the restored original" >&2
    fi
    mv "$moved" review-report
  fi
  if [[ -n "$tracked" ]]; then
    local after
    after="$(git status --porcelain 2>/dev/null)"
    if [[ "$after" != "$before" ]]; then
      echo "check-clean: the check changed the working tree — a committed generated file is stale, or the check rewrites files:" >&2
      diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") | sed -n 's/^> /  /p' >&2
      [[ $rc -eq 0 ]] && rc=3
    fi
  fi
  exit "$rc"
}
trap restore EXIT

"$@"
