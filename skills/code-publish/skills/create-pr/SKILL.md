---
name: create-pr
description: >
  Use when asked to open, create, file, submit, or ship a pull request / PR
  for the current branch or a finished change — or to write, improve, or
  retrofit a PR title or description, including rewriting an existing PR's
  title and body to this standard. Produces an outcome-led title in the
  repo's own convention and a problem-first description a reviewer can
  understand without reconstructing the motivation from the diff.
---

# Create PR

A PR exists to be reviewed and to be found later. Both audiences read the same
two things: a title in a list of many, and a description that must explain why
the change exists. Optimize for them — not for documenting your work.

## 1. Before writing anything

1. **Check for an existing PR** on this branch: `gh pr list --head <branch>`.
   If one exists, update it (`gh pr edit`) instead of opening a duplicate.
2. **Establish the base branch** (`gh repo view --json defaultBranchRef`, or
   the base the user named) and read the real change:

   ```bash
   git log origin/<base>..HEAD --oneline
   git diff origin/<base>...HEAD --stat
   ```

   Read the full diff for anything you didn't write yourself this session.
3. **Confirm the diff matches the goal.** The PR should contain what was asked
   for — nothing else. If the branch carries unrequested or leftover changes,
   surface that to the user before filing, don't describe around it.
4. **Learn the repo's conventions** — follow what the repo does, not your
   habits:

   ```bash
   gh pr list --state merged --limit 15 --json title,number
   git log --oneline -20
   ```

   Note prefix style (Conventional Commits `feat:`/`fix:`, area prefixes,
   none), capitalization, and typical length.
5. **Check for pre-PR gates** in the repo's AGENTS.md / CLAUDE.md /
   CONTRIBUTING (required reviews, changelogs, ADRs, test commands). Satisfy
   them first — a PR that skips the repo's own gates isn't ready to file.

## 2. Title

In squash-merge repos the PR title becomes the commit subject, so title
discipline is commit-subject discipline: **imperative or outcome phrasing,
≤ ~70 characters, no trailing period**, prefixed however the repo prefixes.

**Lead with the outcome, not the mechanism.** Say what changed for users,
operators, or readers of the system; the mechanism goes after, if it fits.
The test: someone scanning the merged-PR list should be able to tell from the
title alone what this PR did for them — without opening it.

| ✗ Mechanism-led | ✓ Outcome-led |
|-----------------|---------------|
| Perf server, negotiate per-message deflate on the WebSocket | Perf server, cut WebSocket frame size by 70% with gzip |
| Update UserService and refactor auth middleware | Fix sessions surviving password change |
| Add composite index to orders table | Cut order-list load from 4s to 200ms with an orders index |

If you can't state an outcome, that's a signal — either the change doesn't do
anything a reader would care about (say what it enables instead), or you don't
understand it well enough yet to file it.

## 3. Description

Structure, in this order:

1. **Problem** — from the user's original request: what was wrong, missing,
   or needed, and for whom. 2–4 sentences. This comes first because it's the
   one thing a reader cannot get from the diff.
2. **Solution** — how the change addresses it, at the level of approach and
   key decisions (and trade-offs, if any were real). Name the important moving
   parts; do not inventory files.
3. **Verification** — what you actually ran or tested and what happened.
   Honest scope: if something wasn't verified, say so plainly.
4. **Notes for the reviewer** *(only when needed)* — risky spots, follow-ups
   deferred with the user's agreement, migration steps, breaking changes.
   Screenshots or a short video for anything visual.
5. **System change block** *(only when the repo has a primitives map)* — if the
   base branch has a `primitives.yaml` under `docs/` and the review toolkit's
   `review-pr` skill is installed, include its system-recap block: build a
   minimal findings JSON (`{"meta":{"headSha":"<sha>"},"verdict":{},
   "systemChange":{...}}`) by classifying the diff's touched primitives against
   the map's `sources` (composes / extends / adds, per the map's own key), then
   `bun run <review-pr-skill-dir>/recap.ts <that file>` and paste the emitted
   block into the body. The block is wrapped in HTML-comment markers, so a
   later `/review-pr` recap refreshes it **in place** — putting it here at
   creation is what makes the retroactive "want me to upsert the recap?" dance
   unnecessary. Skip silently when there's no map or no toolkit; don't
   hand-roll the block.
6. **Attribution** — which model and harness produced the change, e.g.
   *"Written by Claude Fable 5 via Claude Code."*

The bar: a reader who knows the codebase but not this task should understand
**why the change exists** from the description alone — the diff should only
confirm *how*.

### Anti-patterns (all of these have burned us)

- **Leading with implementation details** — "Refactored X into Y" is the
  diff's job; the description's job is why.
- **File-by-file inventories** and emoji category sections (✨/🐛/♻️) — noise
  dressed as structure.
- **Checkbox checklists** ("[ ] tests pass") — nobody fills them honestly;
  state what you verified in prose instead.
- **Restating the diff without motive** — "Changed timeout from 30s to 60s"
  explains nothing; "uploads over 40MB were timing out" does.
- **Hedged claims** — "should work", "improves performance". Give the number
  or the test, or mark it unverified.

## 4. Filing

- Open a **real PR, not a draft**, when review bots need to run on it. Draft
  only when the user explicitly asked for a draft.
- One PR per concern — if the branch contains two unrelated changes, tell the
  user rather than filing a grab-bag.
- After filing, report the PR URL. Continue into monitoring/babysitting the
  PR (checks, review comments, rebases) **only if the user asked for that** —
  it is a separate job.

## 5. Retrofit an existing PR

When asked to bring an **existing** PR's title and body up to this standard
("rewrite this PR description", "fix up PR #42's title"):

1. **Own PRs only** — yours or your automation's under your account. Editing
   someone else's PR description is off-limits; offer them the rewritten text
   in chat instead.
2. Read the PR (`gh pr view <n> --json title,body,commits`), its full diff,
   and any linked issues — then apply sections 2 and 3 exactly as if filing
   fresh. The Problem section usually hides in the linked issue or the first
   commit message; dig it out rather than paraphrasing the old body.
3. **Preserve what other tools maintain**: the system-recap block between its
   `<!-- system-recap:start/end -->` markers, attribution footers, and any
   HTML-comment markers you don't recognize — rewrite around them, never
   through them.
4. Show the before/after title and body and **confirm before `gh pr edit`** —
   editing a filed PR is a visible action, and in squash-merge repos the title
   you're changing is the future commit subject.
