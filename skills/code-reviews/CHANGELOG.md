# Changelog

Versions align with the plugin manifest. Entries below distill each evolution
round (one PR per round — see [EVOLUTION.md](EVOLUTION.md)); the pre-public rounds
lived in the private dev-tools repo, whose PR bodies carry the full evidence.

## 0.1.0 — first public release

Round 23 (the first round in this repo) plus the complete pre-public history:

- **R23** — `fixWorks` command-settled on owned checkouts (consensus validates the
  problem, not the fix); materialized-merge gate (scratch-worktree merge + gates —
  `merge-tree` exit 0 only proves the *text* merges); evidence examples get
  anchor-grade skepticism; tier ladder as a predicate table with a trivial rung;
  `check-clean.sh` ships; preflight `verifiable` field.
- **R22** — Fowler smell baseline as the conventions lens's fallback citation
  source; intent's spec-discovery ladder (PR body → linked issues → spec files);
  empty-diff fail-fast. (Takeaways from mattpocock/skills, with credits.)
- **R21** — verifier-verdict normalization; `featureArea` verbatim-from-triage;
  publish consent parity; `fix` joins the compact index.
- **R20** — seams runs whenever triage finds interfaces (sharded-only rationale
  field-falsified); `fixWorks` promoted to a contract field; dedupe merging as
  assembly; arbiter anti-laundering invariant (group severity ≥ max absorbed).
- **R19** — `<base>` = `origin/<baseRefName>` everywhere (stale-local-base bug);
  `--gist` hard-refuses non-public repos; `repo=<path>` cross-checkout reviews;
  the complete light→medium→full→sharded tier ladder.
- **R18** — hydration-miss check; sibling-checkout `node_modules` fallback;
  risk-raises-tier-by-one; holistic demoted to eval cadence; debt routing
  (untouched-code eligibility, `ops-advisory`).
- **R17** — seams owns external boundaries (app↔platform, app↔library); dedupe
  layers inverted (title scan primary); scorecard reconciled against the verified
  pool; green CI on head SHA satisfies the baseline.
- **R16** — merge-forward becomes lens *material* (base-side diff of the PR's
  files); conflict-probe output is a first-class `merge` finding; interfaces
  sharding gate; arbiter delta contract; disagreement-gated light arbiter.
- **R15** — first-five dependency-contract checks (`node_modules` source is
  in-scope evidence); verify's novel-claim quotes go bidirectional; per-finding
  `verifiedBy`; holistic eval hygiene (unsteered prompts only).
- **R12–R14** — `trackedIssue` write-back loop (issues ↔ publish ↔ resolve);
  fail-loud `validateReport`; `reset-workspace.sh`; `checkPrMismatch`;
  nearest-changed-line anchoring for blockers; moving-base re-check.
- **R9–R11** — the trust model completed: escalation guard (verifiers shrink,
  never grow), light lens paths, trust-follows-ownership, mock-fidelity checks,
  differential baselining, defect-vs-style divergence rules, unconditional anchor
  normalization.
- **R5–R8** — verification epistemology: mechanical / experiment / documentation /
  judgment buckets, contradiction scan, fix-correctness checks, compaction
  protocol (full findings to disk, compact indexes in context), context bundles,
  the orchestrator-observation rule.
- **R1–R4** — the foundations: adaptive sharding + seams lens, severity arbiter
  (grouping, budget, per-site notes), holistic eval flag, review-debt lane
  (`review-issues` + fingerprint/title dedupe), subagent return contracts,
  hook-neutralized checkouts, merge-forward review, guard-probing heuristics.

Also in 0.1.0: the primitives lens + System change card + GitHub recap block
(KCD's primitives/visual-recap patterns), and the plugin/skills-CLI packaging.
