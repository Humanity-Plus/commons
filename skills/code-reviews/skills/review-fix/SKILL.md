---
name: review-fix
description: >
  Review the current branch (or your own PR) and fix it in one pass — runs the
  full review-pr pipeline in findings-only mode (no HTML report), then applies
  resolve-review's scoped fixes on the branch and reports a resolution table to
  chat. The fast local loop before opening a PR. Use when asked to review and
  fix in one go, run the pre-PR loop, or clean up work the user owns. Writes
  code — only for branches/PRs the user owns; use review-pr for anyone else's.
---

# Review & Fix

Review the current work **and** fix it in one pass — no HTML report, results reported
straight to the chat. This chains two skills: `review-pr` (to find issues) then
`resolve-review` (to fix them). Use it as the fast local loop on your own branch.

## Arguments

The user may pass a target when invoking the skill (e.g. `/review-fix <target>`):

- A **branch name** → review that branch against its base, then fix on it.
- A **PR number/URL** → allowed **iff the PR is yours**, see below.
- **Nothing** → review the current branch against `main`, then fix on it.

This skill **writes code**, so it's for work you own in local mode.

**The PR-argument rule (the safety posture flips on it):** a PR argument is fine
**iff the PR is yours** — authored by you, *or by your own automation publishing
under your account* (a scheduled routine's PR on your repo is yours; the author
being an agent doesn't weaken the trust posture when it runs under your identity).
Verify with `gh pr view <ref> --json author` against the authenticated user. It then
becomes **local mode on that branch**: hook-neutralized checkout per the `review-pr`
skill's Phase 0, dirty-tree stop, and all of `resolve-review`'s write rules. For any
other author — colleagues, forks, anyone — this skill refuses; use `review-pr`
(report-only, HTML report) for those.

**Fresh worktree / wrong branch:** if the target is one of *your own* PRs and the
current `HEAD` isn't its head commit, check the PR branch out first (hook-neutralized,
per the `review-pr` skill's Phase 0) — but stop and ask before switching if the
working tree is dirty. Never review-and-fix while sitting on a different branch than
the code under review.

## What to do

1. **Baseline the repo's checks.** This skill runs on a branch you own, so unlike
   report-only `review-pr` it may run the repo's **existing** check scripts. Do it
   before reviewing: lint and typecheck, discovered from the repo's own scripts —
   in monorepos use the workspace runner (`turbo …`/`nx …`/`bun run <script>`),
   never bare tools, since per-package configs make root invocations lie.
   **Distrust the local environment before you trust a failure** — differential
   baseline: a failing check is ground truth about the PR **only if the same check
   passes on the base branch in the same environment**. If base fails too, the
   problem is the environment or the stale branch, not the PR; check next whether
   installed tool versions match the lockfile (a TypeScript two minors ahead of the
   lockfile produces failures that look exactly like PR defects). Only failures
   that survive the differential get handed to the lenses as ground truth: on a
   stale branch, a failing CI-enforced check is exactly where a blocker hides, and
   no read-only lens can see it.
   (Baseline **before** `review-report/` exists; for whole-repo checks later, run
   them through `<review-pr-skill-dir>/check-clean.sh <cmd…>` — it moves the
   artifact aside and trap-restores it, so a red check can neither point into
   your own artifact nor strand it.)
2. **Review (findings only).** Invoke the `review-pr` skill in **findings-only mode**:
   run the same full lens sequence as a normal review — triage → first-five, conventions,
   warm, zombies, preflight, intent → verify → arbiter — exactly as normal, write
   `review-report/findings.json`, but **skip the HTML render step** (no `report.html`,
   don't open a browser). (`intent` runs whenever a spec source exists — the PR body, linked issues, or a
   spec file under `docs/specs/` matching the branch — and self-skips only when
   none is found; local branches with a findable spec get it too. On large diffs the skill may also shard and run
   the `seams` lens — leave that to the skill.) Findings-only runs always use the
   skill's **compaction protocol**: lenses write full findings to
   `review-report/lenses/*.json` and return compact indexes; the orchestrator
   assembles the handoff from those — the consumer here is the fix phase, not a
   report reader.
3. **Fix.** Invoke the `resolve-review` skill on those findings: plan → apply scoped
   edits on the current branch → validate with the repo's existing checks.
4. **Report to chat.** Lead with **blockers language, not GitHub-review language**
   (nothing is being published, so `request-changes`/`approve` means nothing here):
   *"N blockers (critical/high) · M should-fix (medium) · K advisories — X of them
   now fixed."* Order matters: **unfixable blockers come first**, above the
   fixed-count — the fix phase can't do commit-level remediation (rebase, merge,
   revert) or deploy actions, and those hand-backs are often the only findings that
   will actually bite on merge; they must not read like an appendix. Then the
   resolution table — counts by status (`fixed`/`partial`/`skipped`/`failed`), what
   changed per finding (with `file:line`), the rest of the **"over to you"** list,
   and `git diff --stat`. **Call out the below-threshold leftovers explicitly**: a
   repo whose `REVIEW.md` caps craft findings at `low` (common, correct) means
   conventions findings are *never* in the default fix set — say "N conventions
   findings below the fix threshold: file them with `review-issues`, or re-run
   with threshold `low`" instead of letting them vanish silently. Do **not** commit
   unless the user asks.

If either skill is missing, tell the user to install it
(`npx skills add Humanity-Plus/commons`) rather than doing the review or the fixes
by hand — the skills carry the lens definitions, the safety rules, and the fix
procedure.
