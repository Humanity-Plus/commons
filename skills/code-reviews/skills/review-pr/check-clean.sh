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
#   exit 3  the check passed but changed the working tree: a path's git status
#           changed, or the content of a modified or untracked file did. A
#           committed generated file is stale, or the "check" rewrites files.
#           Field: a stale api.d.ts no lens could see. (A check that itself
#           exits 3 keeps its code; the message on stderr tells the two apart.)
#   exit 2  the script could not do its own job (see the messages below).
#
# Whatever was written into review-report/ WHILE the check ran (a lens
# finishing late) is merged into the restored original, empty folders included.
# The restore stops, with exit 2 and both locations named, when a path exists
# on both sides, anything cannot be moved, or review-report came back as
# something other than a folder — no file is ever deleted, only moved.
# Better still: run no whole-repo check while lenses are in flight. Field: the
# earlier fail-on-any-recreation stranded finished work in a temp folder and
# exited non-zero for a check that had passed.
#
# A running verify-skill instance owns review-report/verify/ for its evidence,
# so the check refuses while one is live. The instance's runtime state lives
# OUTSIDE review-report/, in the git dir (the layout create-verify-skill
# mandates), which is how this script can tell: its pid file is
# $(git rev-parse --git-dir)/verify/.pids. Field: a launch during a check
# recreated review-report/ and the restore nested the original inside it.
#
# review-report/ is the one at the repository's top level, whichever folder the
# check is run from; the check itself runs where you ran this script.
set -uo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: check-clean.sh <command> [args...]" >&2
  exit 2
fi

top="$(git rev-parse --show-toplevel 2>/dev/null)" || top=""
rr="${top:+$top/}review-report"

pids="$(git rev-parse --git-dir 2>/dev/null)/verify/.pids"
if [[ -s "$pids" ]]; then
  for pid in $(cat "$pids"); do
    if kill -0 "$pid" 2>/dev/null; then
      echo "check-clean: a verify-skill instance is running (pid $pid in $pids) — stop it with the verify skill's Cleanup first; the check did not run" >&2
      exit 2
    fi
  done
fi

# What the tree looks like before the check, to compare with after it: every
# path's status, and a checksum of each modified or untracked file — a status
# line alone cannot show a second change to a file that was already modified.
# review-report/ is left out of both: it is this script's to move, and a late
# file merged back into it is not a change the check made to the tree. The
# "--" keeps a file named like an option from being read as one.
snapshot() {
  git status --porcelain -- ':/' ':(exclude,top)review-report' 2>/dev/null
  git ls-files -m -o --exclude-standard -z -- ':/' ':(exclude,top)review-report' 2>/dev/null | xargs -0 cksum -- 2>/dev/null
}
tracked="" before=""
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked=1
  before="$(snapshot)"
fi

moved=""
if [[ -d "$rr" ]]; then
  tmp="$(mktemp -d)" || exit 2
  moved="$tmp/review-report"
  if ! mv "$rr" "$moved"; then
    echo "check-clean: could not move review-report/ aside, so the check did not run" >&2
    exit 2
  fi
fi

restore() {
  local rc=$?
  if [[ -n "$moved" && -d "$moved" ]]; then
    if [[ -e "$rr" || -L "$rr" ]]; then
      local stuck="" why="" f rel
      if [[ -d "$rr" && ! -L "$rr" ]]; then
        # first look, then move: a path on both sides stops the merge before anything moved
        while IFS= read -r -d '' f; do
          rel="${f#"$rr"/}"
          if [[ -d "$f" && ! -L "$f" ]]; then
            [[ ! -e "$moved/$rel" || ( -d "$moved/$rel" && ! -L "$moved/$rel" ) ]] && continue
          elif [[ ! -e "$moved/$rel" && ! -L "$moved/$rel" ]]; then
            continue
          fi
          stuck="$rel" why="exists on both sides"
          break
        done < <(find "$rr" -mindepth 1 -print0)
        if [[ -z "$stuck" ]]; then
          # find lists a folder before what is in it, so each file's folder is there first;
          # mv -n never overwrites, and a file that did not leave is caught on the next line
          while IFS= read -r -d '' f; do
            rel="${f#"$rr"/}"
            if [[ -d "$f" && ! -L "$f" ]]; then
              mkdir -p "$moved/$rel" 2>/dev/null && continue
            elif mv -n "$f" "$moved/$rel" 2>/dev/null && [[ ! -e "$f" && ! -L "$f" ]]; then
              continue
            fi
            stuck="$rel" why="could not be moved"
            break
          done < <(find "$rr" -mindepth 1 -print0)
        fi
        # only folders are left when every move worked, and each now exists in the original
        [[ -z "$stuck" ]] && find "$rr" -depth -type d -exec rmdir {} \; 2>/dev/null
        if [[ -z "$stuck" && -e "$rr" ]]; then stuck="a file written after the merge began" why="is still there"; fi
      else
        stuck="review-report" why="was recreated as something other than a folder"
      fi
      if [[ -n "$stuck" ]]; then
        echo "check-clean: review-report/ was recreated while the check ran and '$stuck' $why, so the original was NOT restored — the check exited $rc; nothing was deleted: finish the merge by hand from what is still in $rr into the original, which is left at $moved" >&2
        exit 2
      fi
      echo "check-clean: files written to review-report/ while the check ran were merged into the restored original" >&2
    fi
    mv "$moved" "$rr"
  fi
  if [[ -n "$tracked" ]]; then
    local after
    after="$(snapshot)"
    if [[ "$after" != "$before" ]]; then
      echo "check-clean: the check changed the working tree — a committed generated file is stale, or the check rewrites files:" >&2
      diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") |
        sed -n -e 's/^> [0-9][0-9]* [0-9][0-9]* \(.*\)$/  content changed: \1/p' \
          -e '/^< [0-9][0-9]* [0-9][0-9]* /d' \
          -e 's/^< \(.*\)$/  was: \1/p' -e 's/^> \(.*\)$/  now: \1/p' >&2
      [[ $rc -eq 0 ]] && rc=3
    fi
  fi
  exit "$rc"
}
trap restore EXIT

"$@"
