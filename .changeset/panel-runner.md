---
"humanity-plus-commons": minor
---

`review-pr` can ask another vendor's model to read the same change: the `panel` arg.

- **`panel=<runner>`** (for example `panel=agy`, or `panel=codex,agy`) starts one extra reviewer per runner you name, on that vendor's own agent CLI, with the same materials the lenses get. Its findings are verified under the same rules as any lens's, and a **Panel** card reports what each runner found, what survived, and the panel-only findings: what no reviewer on your usual model found. Off by default. It needs that CLI installed and signed in (`codex`, or Antigravity's `agy`), or a delegation tool your harness provides; a runner that is not available is reported as not run.
- **One round, never a loop.** The review's exit is still its verdict, never a score and never a panel's satisfaction.
- **What leaves, and when.** The extra reviewer runs in a scratch copy holding only the tracked files at the reviewed commit, and its provider receives what it reads there. A runner's reading mode stops edits, not commands, so `panel` runs only where the review may already execute code: your own checkouts, or collaborators' PRs when the repo's `REVIEW.md` opts in under `## Trust`. On a repo that is not yours, the runner must also be named on a new `runners:` line in that section. The same line now governs `interrogate`'s seat on an external runner. A vendor is always named: bare `panel` is refused.
