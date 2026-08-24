---
name: publish-review
description: >
  Post the findings from a previous review-pr run to the GitHub PR as one real
  review — findings anchored in the diff become inline file:line comments, the
  rest folds into the review body. Always dry-runs first and confirms before
  posting. Use when asked to publish or post a review, send review findings to
  GitHub, or put a finished review-pr report on the PR.
---

# Publish Review

Post the findings from a **previous** review to the GitHub PR as one real review —
inline comments anchored at `file:line`, everything else grouped in the review body.
Use the **`review-pr`** skill's `publish.ts` for this (see "Publishing the review to
GitHub" in its SKILL.md). Do not post comments by hand with `gh`; invoke the script.

## Arguments

The user may pass options when invoking the skill (e.g. `/publish-review <options>`):

- **`gist`** → also host `review-report/report.html` as a secret gist and link it
  from the review (viewable via htmlpreview.github.io; secret gists are
  public-by-URL, so skip for sensitive repos).
- A **URL** → link that as the full HTML report instead (`--report-url`).
- A **severity** (e.g. `medium`) → only findings at/above it become inline comments
  (`--min-severity`); the rest fold into the review body.
- **`body-only`** → one summary comment, no inline comments.
- **`recap`** → also upsert the system-recap block into the PR description
  (`bun run <skill-dir>/recap.ts review-report/findings.json --pr <n>`; requires the
  review to have a `systemChange` section from the primitives lens).
- **Nothing** → post inline comments for all anchorable findings, no report link.

## What to do

1. Confirm `review-report/findings.json` exists and is a **PR-mode** review
   (`meta.prNumber` and `meta.repo` set). If not, tell the user to run
   `review-pr` on the PR first — publishing needs a PR to attach the review to.
2. **Dry-run first, always**:
   `bun run <skill-dir>/publish.ts review-report/findings.json --dry-run [flags]`
   (with `<skill-dir>` resolving to the installed `review-pr` skill, e.g.
   `~/.claude/skills/review-pr` — never a copy inside the repo under review).
   Summarize for the user: the review event, how many findings post inline vs. in
   the body, and the first line of each inline comment.
3. **Confirm consent, then post.** Posting is a visible, attributed action on
   someone's PR. **Consent can be inherited**: when the invoking instruction itself
   explicitly says to publish (a user prompt like "file your findings with
   publish-review", or a routine prompt that includes publishing), that instruction
   *is* the consent — run the dry-run as a self-check, then post without
   re-asking. Inherited consent must be explicit about publishing; "review this
   PR" alone is not it — then ask, and post only on yes. Either way, report the
   posted review's URL.

If the `review-pr` skill is not available in this environment, tell the user to
install it (`npx skills add Humanity-Plus/commons`) rather than posting comments
manually — the publish script contains the diff-anchoring and markdown-degradation
logic.
