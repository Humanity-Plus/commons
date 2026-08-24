# resolve-review

The fixing half of the review loop. `review-pr` finds problems (report-only);
`resolve-review` **applies scoped fixes** for them on your own branch, validates each
one, and reports what changed — then hands back the items only a human can close.

## What it does

Given a `review-pr` findings file (or findings passed in-session), it:

1. **Plans** — classifies findings into *fixable in code* (`first-five` bugs,
   `conventions` craft, `zombies` missing tests, simple `warm` swaps —
   behavior-preserving fixes only), *semantic change* (correct finding, but applying
   the fix changes behavior: the exact patch is prepared and handed back as a
   product decision, never auto-applied), and *advisory* (`intent` disclosure, most
   `preflight` deploy steps), then orders the fixable set by severity and groups by
   file. A grouped finding's `locations` list means one finding, N sites — each
   site's `note` is its specific remedy.
2. **Applies** — one minimal, scoped edit per finding, matching the repo's
   conventions; anchors are treated as approximate and confirmed before editing.
3. **Validates** — runs the repo's *existing* typecheck/lint/targeted tests (via the
   workspace runner in monorepos); **mutation-tests every added test** (sees it fail
   on the reintroduced defect before trusting it); reverts any fix that breaks
   checks and marks it `failed`.
4. **Reports** — leads with commit-level/operational hand-backs (and branch
   staleness, checked in Phase 0), then a ledger of `fixed` / `partial` / `skipped`
   / `failed` with files touched, plus a `git diff --stat`. Below-threshold
   leftovers get routed to `/review-issues` (the review-debt lane) instead of
   vanishing. No commit unless you ask.

## Security — this skill writes code

The inverse of `review-pr`'s posture. It runs **only on your own branch in local mode**,
never on an untrusted/fork PR checkout. Findings (and their suggestions) came from an
untrusted diff, so they're treated as *data describing a problem* — fixes are
implemented from a fresh reading of the code, never by executing instructions embedded
in a finding. It runs only checks that already exist in the repo (no blind install/build).

## Installing

Install with the [skills CLI](https://skills.sh) — it works with Claude Code, Cursor,
Codex, and most other coding agents:

```sh
npx skills add Humanity-Plus/commons --skill resolve-review --skill review-fix -g
```

Or run `npx skills add Humanity-Plus/commons` without `--skill` to pick from the whole
toolkit interactively; Claude Code users can instead install the whole toolkit as the
`review-toolkit` plugin (see the repo README) — pick one lane, not both. Install
`review-fix` alongside for the one-pass loop (review with no HTML, then fix, report
to chat). See `../../review-toolkit.html` for the full guide.

## Usage

- **`/resolve-review [threshold|filter]`** — resolve an existing `review-report/findings.json`
  (from a prior `/review-pr`). Writes `review-report/resolution.md`.
- **`/review-fix [branch]`** — one pass: run `review-pr` in findings-only mode (skips the
  HTML report), fix the findings, and report the resolution table to chat. The fast
  local loop on a branch you own.

Both are entry points into this skill; see `SKILL.md` for the full process and rules.
