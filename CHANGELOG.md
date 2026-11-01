# humanity-plus-commons

## 0.5.0

### Minor Changes

- [#44](https://github.com/Humanity-Plus/commons/pull/44) [`67c41a6`](https://github.com/Humanity-Plus/commons/commit/67c41a63378b4323e314dcce009afc5c52bda6ac) Thanks [@Paalt](https://github.com/Paalt)! - The review flow now detects mistake classes and hardens them instead of patching them again, and the feature-map join stops over-selecting journeys.

  - **`fix-the-class` joins the toolkit** (adapted from pstack's `correct`): after a correction the repo has seen before, or as a hardening pass, find the mistake classes from the repo's own record and make each impossible at the highest level that works — architecture, types, a check whose error names the fix, a test, prose last — proven red on a real past instance, with an `AGENTS.md` table of rules and what enforces them.
  - **`review-pr` marks classes mechanically** (Phase 4, after the arbiter): a finding gets `classEvidence` when it has several sites in the diff, cites a rule the rules table marks `prose only` or does not list, or matches a defect an archived review or an open `review-debt` issue already recorded. The report gains a `class` chip and a **Classes** card; the published review body lists the classes before the sections.
  - **`resolve-review` hardens class findings** instead of only patching them: every site fixed, then `fix-the-class` at the guard levels (types, check, test) proven red on the instance just fixed, a rules-table row added or raised, architecture moves handed back as their own PR, and every sibling left outside the branch's scope named by `file:line`. The ledger gains a Classes block.
  - **The feature-map join narrows by symbol.** A changed file listed by several features keeps a feature only when another of its changed Paths matched directly or one of its Paths references an export the diff changed; a file with no exports drives every feature that lists it (field: a three-file refactor of a shared helper selected eight journeys). Features set aside are recorded as `not-affected`; the Driven-features block gains that word.
  - **Launch works from a fresh worktree.** `create-verify-skill` requires Launch to name what a worktree lacks (gitignored env files, per-checkout deployments, caches) and the repo's own setup command that provides them; refresh re-audits it.
  - Contract tests pin the `classEvidence` field name, the rules-table heading, and the narrowing phrase across producers and consumers.

## 0.4.0

### Minor Changes

- [#38](https://github.com/Humanity-Plus/commons/pull/38) [`1bb2a68`](https://github.com/Humanity-Plus/commons/commit/1bb2a68432cce55f3f847cb618d0c59f1064dee8) Thanks [@Paalt](https://github.com/Paalt)! - New `blast-radius` lens in `review-pr`, for changes that ship to production. It names the one **safety fact** the change rests on, proves it as far as reading allows on an evidence ladder (asserted → documented → traced → command-settled → observed, the same names as `verifiedBy`), writes the probe that settles it by execution, walks the change's reach past grep (other readers of the same bytes, the library at its pinned version, the path production actually runs, timing, rollback), and reports what it **cleared** as first-class output. On your own checkout the orchestrator runs the probe, so the fact arrives proven or contradicted. The report leads with a Blast radius card, `publish.ts` puts the fact at the top of the GitHub review body, and `resolve-review` re-runs the probe after its fixes. Runs from the medium tier up; trivial and light diffs skip it. The method adapts the `blast-radius` skill in Lauren Tan's (poteto) MIT-licensed pstack, credited in the toolkit README.

- [#41](https://github.com/Humanity-Plus/commons/pull/41) [`b5389a5`](https://github.com/Humanity-Plus/commons/commit/b5389a548cd427d360cf78107b944cab330cfc93) Thanks [@Paalt](https://github.com/Paalt)! - New `create-verify-skill` skill: generates — or refreshes — a repo-local `verify-<app>` skill that drives the real app the way a user does (launch, doctor, personas, drive, evidence, cleanup) plus a feature map with one file per user-facing feature, its source **Paths** and the seeded **Personas** it needs, proven by an observable end state. The generator interviews the repo, writes the skill into the host's project skill directory, and drives one feature end to end before handing over; refresh mode runs source readers per feature and one live pass and leaves only proven corrections in the working tree (a PR when asked). Both modes run on your own checkout against a local or disposable instance. The toolkit consumes the skill by shape: `review-pr` runs experiment claims and the blast-radius probe through its recipes on owned checkouts, and `resolve-review` drives the features a review touched after its fixes land, with the outcome in the resolution ledger. The method adapts the `create-verification-skill` and `maintain-verification-skill` skills in Lauren Tan's (poteto) MIT-licensed pstack, credited in the toolkit README.

- [#40](https://github.com/Humanity-Plus/commons/pull/40) [`fef7ba8`](https://github.com/Humanity-Plus/commons/commit/fef7ba8e57511921be71c74f2454eb4f4de8ae3d) Thanks [@Paalt](https://github.com/Paalt)! - New `interrogate[=N]` arg for `review-pr`: the pipeline's one offensive pass. N adversaries (default 2), each in its own scratch worktree, are briefed to break the change by running it — three focuses, inputs and boundaries / state and time / environment and integration, assigned round-robin — and a finding survives only when the orchestrator's rerun in a fresh worktree reproduces it; the repro command, patch, observed and expected output travel with the finding and render on its card. Adversaries execute code, so the arg is honored only on an owned checkout or under `REVIEW.md`'s `## Trust`. Runners are detected, never assumed: seats run on the host's subagents, and when the Codex CLI is on `PATH` one seat runs there so the adversaries span model families; with one family the report says diversity came from the briefs. An Interrogation card shows each seat's found / kept / dropped ledger and the interrogate-only findings. Off by default, like `holistic`. The method adapts the `interrogate` and `arena` skills in Lauren Tan's (poteto) MIT-licensed pstack, credited in the toolkit README.

### Patch Changes

- [#43](https://github.com/Humanity-Plus/commons/pull/43) [`5dcaca0`](https://github.com/Humanity-Plus/commons/commit/5dcaca00f1063d9ee529ea2084aeb7b58c8da9fb) Thanks [@Paalt](https://github.com/Paalt)! - Field round from a five-PR queue run. `review-pr`: a repeated mechanical substitution (the same literal, rename, or import swap in every hunk) takes the light tier however many files it touches, and the light-tier text now defers to the ladder row instead of restating it; when the conflict probe hits most of a PR's files and base replaced what the PR edits, the review asks whether the PR is superseded — goal met on base by reading and measurement — before planning any merge. The `intent` lens compares equivalence and duplication claims (keys, resolved values, exports) instead of accepting them. `recap.ts` emits a one-line classification-only block when no mapped primitive was touched, instead of an empty diagram and table. `reset-workspace.sh` leaves `review-report/verify/` in place when it archives stale findings — evidence dirs are keyed by phase and SHA, and moving them dangled every link the findings recorded. A running verify instance and the review scripts no longer collide: the generator now mandates runtime state (pids, port, head, log, registered clients) in the git dir — `$(git rev-parse --git-dir)/verify/`, shared registrations one level up in the common dir — so `review-report/verify/` holds evidence only; `check-clean.sh` refuses while those pids are alive and fails loudly, leaving the original where it names, instead of nesting `review-report/review-report` when a launch recreated the directory mid-check; a contract test pins the pid-file path across generator and script. Existing generated skills pick the layout up on their next refresh. `create-verify-skill`: identifiers a generated Launch derives from the checkout path are sanitized to the target's charset, Doctor prints them, and refresh mode re-reads Launch, Doctor, and Cleanup against the generator's contract so existing skills pick the rule up. Review-fix on this round added: a superseded verdict is always `comment`, never `approve`; the review-pr README defers to the ladder row and a contract test keeps the light-tier predicate stated once; the light generalist owes a substituted token the hidden-reader grep that blast-radius would have done at a higher tier.

## 0.3.5

### Patch Changes

- [#36](https://github.com/Humanity-Plus/commons/pull/36) [`74a45c6`](https://github.com/Humanity-Plus/commons/commit/74a45c6e6472b8576b4db001b52da5ad25d2ffca) Thanks [@Paalt](https://github.com/Paalt)! - Both plugins now link their directory listing to a setup guide at humanityplus.solutions/commons/plugins, which covers the `REVIEW.md`, convention docs, and primitives map the Review Toolkit reads, and the repo files Code Publish checks. The listings now declare their icons and link to support (GitHub issues) and a privacy notice stating that the plugins collect nothing. The plugin READMEs point to the same guide, and the Review Toolkit's setup list now includes the convention docs step it was missing.

## 0.3.4

### Patch Changes

- [#34](https://github.com/Humanity-Plus/commons/pull/34) [`955add9`](https://github.com/Humanity-Plus/commons/commit/955add9dca87c300b620bf1b9c3d5ec87444de44) Thanks [@Paalt](https://github.com/Paalt)! - Rewrapped one sentence in the `primitives` lens so the plugin directory's security scan stops reading a line that began with `set;` as the shell builtin that dumps the environment. Lens behavior is unchanged.

## 0.3.3

### Patch Changes

- [#32](https://github.com/Humanity-Plus/commons/pull/32) [`2376465`](https://github.com/Humanity-Plus/commons/commit/237646538add185de3f7e5a7693a9c6fc983c7d7) Thanks [@Paalt](https://github.com/Paalt)! - Reworded a few docs, error messages, and the sample report so the directory's security scan stops reading the word "pass" as the `pass` password manager and the sample's `STRIPE_SECRET_KEY` as a credential the plugin reads. The skills' behavior is unchanged.

## 0.3.2

### Patch Changes

- [#29](https://github.com/Humanity-Plus/commons/pull/29) [`1347b5f`](https://github.com/Humanity-Plus/commons/commit/1347b5fe48182137ef750d5c9034e2eff9af4b28) Thanks [@Paalt](https://github.com/Paalt)! - Both plugins now ship an icon: the Humanity Plus leaf. The review toolkit guide links to Bun's install page instead of showing a download-and-run command, and both READMEs state that the skills never read a token or key.

- [#31](https://github.com/Humanity-Plus/commons/pull/31) [`7e31583`](https://github.com/Humanity-Plus/commons/commit/7e31583671192d532c020e7bac6e8449be92ec0a) Thanks [@Paalt](https://github.com/Paalt)! - `humanity-plus-publish` gets its own icon, the Humanity Plus leaf with a publish badge, so the two plugins are easy to tell apart in the directory.

## 0.3.1

### Patch Changes

- [#27](https://github.com/Humanity-Plus/commons/pull/27) [`945391e`](https://github.com/Humanity-Plus/commons/commit/945391e8765bc7b552600d6f87794edbd66a6333) Thanks [@Paalt](https://github.com/Paalt)! - Three lens definitions reworded in 0.3.0 had quietly narrowed what they check; they're restored to full breadth in our own phrasing. `zombies` Boundaries covers time edges again (expiry at the boundary, clock rollover, DST — not only timeouts), Many covers concurrency again (async interleaving and ordering races — not only parallel access), and `triage`'s always-high rule covers any authentication (API keys and service-to-service auth included — not only user sign-in and sessions).

## 0.3.0

### Minor Changes

- [#24](https://github.com/Humanity-Plus/commons/pull/24) [`3d80f7f`](https://github.com/Humanity-Plus/commons/commit/3d80f7fff32f94f4e866e82da6a9ea91cf1101cc) Thanks [@Paalt](https://github.com/Paalt)! - **The plugins are renamed for the Claude directory:** `review-toolkit` is now `humanity-plus-review` and `code-publish` is now `humanity-plus-publish`. The old names stop resolving once you update the marketplace, so if you installed either plugin, swap it for the new name:

  ```bash
  claude plugin uninstall review-toolkit@humanity-plus
  claude plugin install humanity-plus-review@humanity-plus
  ```

  Do the same for `code-publish@humanity-plus` → `humanity-plus-publish@humanity-plus`, and add `--scope project` (or `local`) to the uninstall if you installed there. If your settings list the plugins under `enabledPlugins`, rename those keys rather than adding new ones. Slash commands move with the plugin, for example `/humanity-plus-review:review-pr`. The skills CLI lane is unchanged.

  Each bundle README now has a one-step install line, says the skills are built for Claude Code, and lists everything the skills run and send. A few lens instructions in `review-pr` (triage, preflight, first-five, zombies) are reworded without changing what they check.

### Patch Changes

- [#26](https://github.com/Humanity-Plus/commons/pull/26) [`6250553`](https://github.com/Humanity-Plus/commons/commit/625055301690abdce9b22cc7c2d452effc392a8a) Thanks [@Paalt](https://github.com/Paalt)! - **`review-pr` and `resolve-review` fixes, from a CodeRabbit review of a repo that vendored the skills:**

  - A `findings.json` from an earlier commit no longer survives new commits on the same PR. `reset-workspace.sh` keeps it only when it describes the checked-out commit, and `resolve-review` stops and asks before editing from findings about different code ([#19](https://github.com/Humanity-Plus/commons/issues/19)).
  - Finding text can no longer close the report's own containers to render a spoofed verdict outside its card ([#20](https://github.com/Humanity-Plus/commons/issues/20)).
  - Copying `REVIEW.example.md` no longer opts you into running colleagues' PRs: the `execution: collaborators` line ships commented out ([#21](https://github.com/Humanity-Plus/commons/issues/21)). If you copied the template before this release, check your `REVIEW.md`'s `## Trust` section.
  - `check-clean.sh` no longer runs the check when it can't move `review-report/` aside ([#22](https://github.com/Humanity-Plus/commons/issues/22)).
  - `SKILL.md` gives one rule for when the `seams` lens runs: whenever triage finds interfaces between areas ([#23](https://github.com/Humanity-Plus/commons/issues/23)).

## 0.2.0

### Minor Changes

- [#15](https://github.com/Humanity-Plus/commons/pull/15) [`8cfe5f2`](https://github.com/Humanity-Plus/commons/commit/8cfe5f2728d8ebabd33a65168fa493dc2a9c9f69) Thanks [@Paalt](https://github.com/Paalt)! - Team/org reviews: repos can opt colleagues' PRs into execution trust (`## Trust` in REVIEW.md, `execution: collaborators` — collaborator-authored, same-repo-head PRs get baseline checks, experiments, and merged-tree gates in a disposable worktree), the seams lens traces migrated grants through every authorization consumer, skeptic verification can reframe a finding to the lesser defect that survives instead of discarding it, and resolve-review states reviewed-SHA vs current head and recommends a re-review after substantial security fixes. Publishing on private repos: `publish.ts --pages owner/name` hosts the HTML report via a Pages-publishing repo (Enterprise access-controlled Pages) and `--recap` puts the system-recap block in the review body for PRs whose description you don't own; the review footer timestamp is now human-readable (DD.MM.YYYY - HH:MM). create-pr includes the system-recap block at PR creation when a primitives map exists, and gains a retrofit mode that rewrites an existing PR's title and body to the same standard.

### Patch Changes

- [#16](https://github.com/Humanity-Plus/commons/pull/16) [`b9e1e8f`](https://github.com/Humanity-Plus/commons/commit/b9e1e8f49c4e3cf83cd25cd31ea65c63e8d6b63a) Thanks [@Paalt](https://github.com/Paalt)! - Report fix: the Dependencies (WARM) table no longer overflows its card. Long unbreakable content in the Notes column — 40-char commit SHAs, command strings in inline code, embedded markdown tables — used to set the column width, pushing the table past the card edge and crushing the Package column to one word per line. The table now uses fixed layout with proportional columns, and inline code and embedded tables wrap inside the Notes cell.

## 0.1.1

### Patch Changes

- [#12](https://github.com/Humanity-Plus/commons/pull/12) [`6e983d7`](https://github.com/Humanity-Plus/commons/commit/6e983d726e56397f4d090fa630adf308473ae82d) Thanks [@Paalt](https://github.com/Paalt)! - Midnight redesign ([#11](https://github.com/Humanity-Plus/commons/pull/11)): the toolkit guide and the review report now share one visual language — near-black indigo-tinted surfaces, hairline borders, Inter + JetBrains Mono. The report renderer (`render.ts`, `recap.ts`) and the finding-style lens were updated to match, so reviews produced by `review-pr` pick up the new look.

- [#9](https://github.com/Humanity-Plus/commons/pull/9) [`4b113c7`](https://github.com/Humanity-Plus/commons/commit/4b113c7068efb2f3a81770b0e3bf37f7d9b60fc0) Thanks [@Paalt](https://github.com/Paalt)! - Add a unified release pipeline with changesets. The version in `package.json` is now the repo's release version; `scripts/sync-plugin-version.mjs` stamps it into every `skills/*/.claude-plugin/plugin.json`, the release workflow maintains a version PR and tags a GitHub Release on merge, and CI fails PRs whose plugin versions drift out of sync. The README documents how each install lane receives updates.
