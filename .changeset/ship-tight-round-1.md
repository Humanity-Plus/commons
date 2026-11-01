---
"humanity-plus-commons": minor
---

ShipTight PR-queue round 1, and the review flow now detects and hardens mistake classes.

- **`fix-the-class` joins the toolkit** (moved from the private kit, adapted from pstack's `correct`): after a correction the repo has seen before, or as a hardening pass, find the mistake classes from the repo's own record and make each impossible at the highest level that works — architecture, types, a check whose error names the fix, a test, prose last — proven red on a real past instance, with an `AGENTS.md` table of rules and what enforces them.
- **`review-pr` marks classes mechanically** (Phase 4, after the arbiter): a finding gets `classEvidence` when it has several sites in the diff, cites a rule the rules table marks `prose only` or does not list, or matches a defect an archived review or an open `review-debt` issue already recorded. The report gains a `class` chip and a **Classes** card; the published review body lists the classes before the sections.
- **`resolve-review` hardens class findings** instead of only patching them: every site fixed, then `fix-the-class` at the guard levels (types, check, test) proven red on the instance just fixed, a rules-table row added or raised, architecture moves handed back as their own PR, and every sibling left outside the branch's scope named by `file:line`. The ledger gains a Classes block.
- **The feature-map join narrows by symbol.** A changed file listed by several features keeps a feature only when another of its Paths references an export the diff changed (field: a three-file refactor of a shared helper selected eight journeys). Features set aside are recorded as `not-affected`; the Driven-features block gains that word.
- **Launch works from a fresh worktree.** `create-verify-skill` requires Launch to name what a worktree lacks (gitignored env files, per-checkout deployments, caches) and the repo's own setup command that provides them; refresh re-audits it.
- Contract tests pin the `classEvidence` field name, the rules-table heading, and the narrowing phrase across producers and consumers.
