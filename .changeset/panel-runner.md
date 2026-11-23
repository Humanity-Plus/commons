---
"humanity-plus-commons": minor
---

`review-pr` can seat another model family: the `panel` arg.

- **`panel[=runner,…]`** gives each available external runner (an agent CLI from another vendor, such as `codex` or Antigravity's `agy`, or a delegation tool your harness provides) one read-only generalist seat with the lenses' materials. Its findings are verified under the same rules as any lens's, and a **Panel** card reports each seat's found, kept, and dropped counts and the panel-only findings: what another family saw that no lens did. Off by default.
- **One round, never a loop.** The review's exit is still its verdict, never a score and never a panel's satisfaction.
- **The seat's provider receives the diff.** On your own checkout the arg is the consent. On anyone else's repo an external seat runs only when that repo's `REVIEW.md` names the runner under `## Review roles`; every provider that received the diff is recorded in the report's limitations.
- **External runners have one rule**, shared by `panel` and `interrogate`: detected, never assumed; flags confirmed against the CLI's own help before the first seat; a seat that fails to start is dropped and noted; a reading seat stays read-only.
