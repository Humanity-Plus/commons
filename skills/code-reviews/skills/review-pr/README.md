# review-pr

Multi-lens code review for a PR or local branch that ends in a self-contained HTML
report. Adapted from the [unlearn.dev skill library](https://github.com/unlearndev/skills).

## What it does

Runs independent **lenses** over one diff, verifies the findings, and renders a
report with visualizations, code snippets, and `file:line` permalinks.

| Lens | Question it answers | Source |
|------|---------------------|--------|
| **triage** | What changed, grouped by feature area and risk? | runs first, drives ordering |
| **first-five** | The 5 things automated changes get wrong (errors, input, external calls, mutations, deps) | bug hunt |
| **conventions** | Does the change follow the repo's own convention docs / `AGENTS.md`, tech-stack idioms, and sibling precedent? (structure, readability, DRY, naming, types, reuse of shared infra) + a per-area scorecard | craft, docs + siblings |
| **warm** | Are new/upgraded dependencies **W**orth it, **A**live, **R**ight-sized, **M**aintained securely? | deps only |
| **zombies** | What high-value tests are missing? (Zero/One/Many/Boundaries/Interface/Exceptions/Simple) | test gaps |
| **preflight** | What must happen to deploy safely? (DB, infra, config, ops) | pre-merge |
| **intent** | Does the diff match what the change claims to do (PR body, linked issues, spec files)? | when a spec source exists |
| **seams** | Do the sides of every contract the diff crosses still fit together (area↔area, app↔platform, app↔library)? | when triage finds interfaces |
| **primitives** | What did the change do to the system's primitives (composes / extends / adds, per Kent C. Dodds' scale), and did it invent shapes outside the repo's `primitives.yaml` map? | needs a primitives map |

Two more subagent passes are not lenses but part of the pipeline: **verify** (a
skeptic pass per finding) and the **arbiter** (Phase 3.5 — regrades severity
relative to the whole report, groups repeated defect classes into one finding with
a `locations` list, and folds findings beyond the report budget into a collapsed
section instead of dropping them).

## Architecture

```text
Phase 0   Resolve input (gh PR or local git diff) → base, head SHA, repo, counts;
          load review context + discover convention docs (base branch, drift-checked);
          detect behind-base state → merge-forward framing; worktree preflight;
          hook-neutralized checkout
Phase 1   triage                     [1 subagent; inline under ~150 distinct lines]
          → feature-area risk map + interfaces
          └─ decide sharding: > shard-threshold (default 400) changed lines
             AND ≥3 feature areas → Phase 2 shards by triage's map
Phase 2   first-five, conventions,   [parallel subagents] → Finding[] each
          warm, zombies, preflight,                         (+ conventions scorecard,
          intent, primitives                                   primitives systemChange)
          ├─ tiered by triage: light (1 file <~50 lines) → medium (single feature
          │  area under the shard threshold: combined bugs+tests generalist +
          │  conventions + globals) → full fan-out (multi-area) → sharded
          ├─ materials inline (or one bundle file above ~10KB of trusted context)
          ├─ sharded, risk-tiered: high-risk areas get per-(lens × area) shards;
          │  medium-risk areas one combined bugs+tests generalist each; low-risk
          │  areas share one pass; conventions shards by doc scope;
          │  + seams lens (whole-diff, cross-area contracts only);
          │  intent / preflight / warm stay whole-diff (inherently global)
          ├─ large / findings-only runs: compaction — full findings to disk,
          │  compact indexes in context
          └─ `holistic` arg: + one whole-diff generalist in parallel,
             findings tagged source: lenses|holistic for overlap stats
Phase 3   verify — contradiction scan first, then per-claim triage:
          mechanical (orchestrator greps) · experiment (owned checkouts only,
          orchestrator runs the probe) · documentation (vendor doc, quoted) ·
          judgment [1 subagent each, fast tier]; suggestions checked for
          fix-correctness; verifiers may shrink claims, never grow them —
          escalations re-enter as new findings with the enabling line quoted
Phase 3.5 arbiter                    [1 subagent; inline when small & nothing > medium]
          → regrade severities relatively, group repeated defect classes
          (locations[] with per-site notes), fold past the report budget
Phase 4   dedupe by defect (not anchor) → verdict → anchors normalized (always)
          → findings.json → render.ts
          → report.html   (findings-only: skip render, blockers-language summary)
          └─ optional, on request: publish.ts → GitHub PR review (inline comments)
```

Every lens emits the same `Finding` JSON shape (documented in `SKILL.md` and the
header of `render.ts`), which is what lets one renderer visualize all of them. The
skill may add optional fields downstream (`area`, `locations`, `regradeNote`,
`folded`, `source`) — all absent on the default small-PR path, so small reviews
produce the same report structure as before.

The **`holistic` flag** exists to measure whether the specialized lenses miss
cross-cutting issues a single full-context pass catches: it runs one whole-diff
generalist reviewer in parallel with the lenses, verifies its findings under
identical rules, and reports `lenses-only / both / holistic-only` overlap counts in
a "Holistic comparison" card — holistic-only findings indicate gaps in the lens
decomposition.

## Installing

Install with the [skills CLI](https://skills.sh) — it works with Claude Code, Cursor,
Codex, and most other coding agents:

```sh
npx skills add Humanity-Plus/commons --skill review-pr -g
```

Or run `npx skills add Humanity-Plus/commons` without `--skill` to pick from the whole
toolkit interactively. Claude Code users can instead install the whole toolkit as a
managed plugin (`claude plugin marketplace add Humanity-Plus/commons`, then
`claude plugin install review-toolkit@humanity-plus`) — pick one lane, not both.
See `../../review-toolkit.html` for the full setup guide and skill reference.

**Fixing the findings.** `review-pr` is report-only. Its companion `resolve-review`
skill applies scoped fixes on your own branch and reports what changed — install it too
for `/resolve-review` (fix an existing report) and `/review-fix` (review with no HTML,
then fix, reporting to chat). See `../resolve-review/README.md`.

## Usage

Invoke it as a slash command — `/review-pr [PR#|URL|branch]` — or ask the agent to
use the `review-pr` skill directly. The skill (`SKILL.md`) is the orchestrator: it
handles PR vs. local detection, spawns the lens subagents, verifies, and calls the
renderer.

To render a findings file directly:

```sh
bun run render.ts <findings.json> [report.html]
```

`sample-findings.json` is a complete fixture — render it to see every section:

```sh
bun run render.ts sample-findings.json /tmp/report.html && open /tmp/report.html
```

Output goes to `review-report/` (gitignored).

### Publishing the review to a GitHub PR

Instead of hand-copying the report into PR comments, `publish.ts` posts the same
`findings.json` as **one real GitHub review**: findings whose `file:line` is in the
diff become inline comments; the rest (preflight, deps, test gaps) go in the review
body, grouped in collapsible sections. Content is degraded to GitHub-flavored
markdown (SVG diagrams point at the full report; `path:line` refs become blob
permalinks), and the verdict maps to the review event (downgraded to a plain
comment on your own PR, where GitHub forbids approve/request-changes).

```sh
bun run publish.ts review-report/findings.json --dry-run          # inspect first
bun run publish.ts review-report/findings.json --gist             # host report + post
bun run publish.ts review-report/findings.json --report-url URL   # self-hosted report
```

`--gist` hosts `report.html` as a secret gist viewable via htmlpreview.github.io —
secret gists are **public-by-URL**, so skip it for sensitive repos. The skill only
publishes when explicitly asked; `--dry-run` shows the exact payload without posting.

The easy path is the **`publish-review`** skill (in `../publish-review/`): run
`/publish-review` in the target repo's chat after `/review-pr`, and the agent resolves
the installed skill path, dry-runs, shows you what will be posted, and posts on your
confirmation — no copying commands between repos. `/publish-review gist` adds the
hosted report link.

## Running it from agents (findings-only, no HTML)

Unattended callers — cloud routines, long agent sessions, pre-PR gates — should use
**findings-only mode**: the full pipeline (triage → lenses → verify → arbiter) runs
unchanged, `review-report/findings.json` is written, and only the HTML render is
skipped. Two entry points expose it: **`/review-pr <target> no-report`**
(review-only, no fix phase — safe on anyone's PR, and the right half of the
"fresh unbiased session reviews, the authoring worktree fixes via
`/resolve-review`" split) and **`/review-fix`** (review + fix on a branch you own). That JSON is the to-do-list contract: `resolve-review` consumes it, applies
scoped fixes in severity order (a grouped finding = every site in its `locations`
list), validates with the repo's existing checks, and reports a
`fixed/partial/skipped/failed` ledger. The **`review-fix`** skill packages the
whole loop — review, fix, report — and is the thing to point agents at.

Three ways to make agents run it automatically, in increasing order of enforcement:

1. **`AGENTS.md` rule** (works in Claude Code, Cursor, and cloud sessions): "Before
   creating any PR, run `/review-fix` and include the resolution summary in the PR
   body." Advisory — a long session can drift past it.
2. **Routine prompts:** for scheduled cloud agents, put the instruction in the
   routine's own prompt ("…then run `/review-fix` before filing the PR"). The prompt
   is the reliable channel there; don't count on the routine noticing an instruction
   file mid-run.
3. **Hook (Claude Code, deterministic):** `../../hooks/require-review-before-pr.sh`
   blocks `gh pr create` until a `findings.json` newer than the last commit exists —
   the harness enforces it, so the agent can't skip it. See `../../hooks/README.md`.

**Non-blocking findings get a lane too.** Low/nitpick findings (readability, naming,
soft conventions) shouldn't block a PR — but they shouldn't die with the report
either. `/review-issues` files them as **grouped, fingerprint-deduped GitHub
issues** (one issue per defect class, not per nitpick; re-reviews don't re-file
tracked debt), labeled `review-debt`, ready for a scheduled fixer like the
`issue-fixer` cloud routine to resolve on its own cadence. Blocking findings get
fixed pre-PR by `/review-fix`; debt flows through the tracker.

**Model selection is role-based, not hardcoded:** every subagent fills a role
(triage, lens, seams, verify, arbiter, holistic) mapped to a capability tier
(`fast` / `balanced` / `strongest`) that resolves against whatever models the host
tool offers — so nothing goes stale when models churn. Defaults live in `SKILL.md`
("Review roles & model tiers"); a repo can override them in a `## Review roles`
section of `REVIEW.md` (see `REVIEW.example.md`).

## The report

- **Findings by severity** (donut, total = every finding) sits next to **Findings by
  section**, which breaks the total into *Findings · Test gaps · Preflight ·
  Dependencies* with counts and per-section severity chips — so a big donut number
  never implies that many *code* findings. Each section renders even when empty (with
  an explanatory state) and shows a count badge in its heading.
- Findings are written like a **short teaching article** aimed at a junior dev.
  `evidence`, `suggestion`, and the verdict `summary` accept **native HTML + inline
  CSS *and* Markdown** — so a finding can carry an inline `<svg>` diagram, a
  `callout` box, side-by-side `cols`, status `badge`s, or a `<table>`, not just
  prose. Markdown (subheadings, lists, **bold**/*italic*, tables, `inline code`,
  fenced code with ```` ```diff ```` colorized) still works for text. Inline **code**
  (lavender chips) and **file/line references** (blue permalinks with a highlighted
  line number) are styled distinctly.
- **Security:** all of that content is derived from an untrusted diff, so it passes
  through an allowlist sanitizer in `render.ts` (`sanitizeHtml`) before hitting the
  browser — `<script>`, `on*` handlers, `javascript:`/remote `url()`, `<iframe>`/etc.
  are stripped, while a rich tag/attribute/SVG subset and a constrained `style`
  attribute survive. Full visual expression, nothing executable.
- The **ZOMBIES** section carries a legend explaining every letter, and **Scope &
  limitations** is a visible card (not buried footer text; sharded runs are noted
  there automatically).
- A finding the arbiter **grouped** renders as one card with a location list for
  every occurrence; findings **folded** past the report budget land in a collapsed
  *More findings* section; on `holistic` runs a **Holistic comparison** card shows
  the lens-vs-generalist overlap counts and lists holistic-only findings.
- When the `conventions` lens runs, a **Conventions & stack conformance** card shows a
  per-area ✓/⚠/✗ scorecard (Convex, React, TypeScript, Tests, …), and a dedicated
  **Conventions** section lists the craft findings with the repo rule each one cites.
- When the `primitives` lens runs (repo has a `primitives.yaml` map — bootstrap
  one with the `map-primitives` skill), a **System
  change** card classifies every touched primitive (composes / extends / adds),
  calls out touched invariants, and renders unmapped new primitives loudest — and
  `recap.ts` can generate a GitHub-native mermaid recap block for the PR
  description (own PRs, on request).

The finding house style lives in `lenses/finding-style.md`, which the orchestrator
hands to every finding-producing lens; it lists the shipped components (`callout`,
`cols`, `badge`, `panel`, `diagram`) with examples.

## Review context (per-repo, kills repeat false positives)

Repo-specific facts the lenses can't infer from a diff — *auth isn't wired yet, no
prod environment so migrations are moot, we stack PRs with Graphite, these paths are
generated* — belong in a committed context file instead of being re-typed each run.
The skill reads it and threads it into every lens, the verify pass, and the verdict.

Create **`REVIEW.md` in the repo root** (the one canonical location); copy
`REVIEW.example.md` as a starting point, and see `REVIEW.worked-example.md` — a
sanitized version of the file from one of our production apps — for what a mature
one looks like. You can also pass a path (`/review-pr 482 context=docs/review.md`)
or just describe the context inline in the request.

`REVIEW.md` is deliberately the same file **Anthropic's Claude Code Review** reads
automatically, so one committed file drives this skill *and* other reviewers with no
per-tool duplication or drift. Compatibility is free but never overrides this skill:
it reads the **whole** file as trusted context regardless of which headings are
present, and this skill's behavior takes precedence. Keep it self-contained — neither
tool expands `@`-imports.

**Trust boundary:** in PR mode the file is read from the **base branch only** (via
`git show <base>:REVIEW.md`), never from the checked-out PR — so a PR can't add a
context file that suppresses real findings. See `SKILL.md` for details.

## Conventions & tech-stack conformance (the `conventions` lens)

The bug lenses stay silent on craft (file structure, readability, DRY, naming, typing,
per-framework idioms). The `conventions` lens covers it — but only against the repo's
**own** rules: it reads `docs/conventions/**`, `AGENTS.md`/`CLAUDE.md`, `.cursor/rules/**`,
and `REVIEW.md`'s `## Always check` / `## Style` / `## Stack` sections (base branch in
PR mode), and every finding **cites the rule it violates**. No repo rule (or documented
best practice for a stack the repo uses) → no finding, so it doesn't devolve into a
generic style-bot. Severity comes from the doc's own emphasis (including tag schemes
like `[Rule]`/`[Convention]`/`[Known gap]`), and it skips what linters/CI already
enforce. It also checks **sibling precedent**: new files are compared against the
closest existing feature of the same kind, and shared infrastructure the diff consumes
is compared against its existing consumers — re-solving a solved problem is a finding
even without a written rule. It also emits a **scorecard** — a per-area (`Convex`,
`React`, `TypeScript`, `Tests`, …) `pass`/`warn`/`fail`/`na` read rendered as its own
card (`na` = area not touched / not applicable).
When the repo has no convention docs, the lens is skipped and says so in *Scope &
limitations*. See `SKILL.md` and `lenses/conventions.md`.

## Stack-aware review (dependent / stacked PRs)

Reviewing a PR in isolation can flag a defect as must-fix when a PR **stacked on top**
already reverts it. This isn't Graphite-specific — Graphite, Sapling/`ghstack`, `spr`,
and manually-chained branches all look the same on GitHub (a PR based on another
feature branch, and/or child PRs based on this one), so detection is **GitHub-native**:
in PR mode it's one or two `gh` calls that run unconditionally and no-op when there's no
stack (the common single-PR case). A stacking CLI (`gt`/`sl`), when present, adds the
full local stack and is what enables this in local mode. When a stack exists, the verify
pass **refutes or downgrades** findings undone downstream and records what it consulted
in *Scope & limitations*; the review itself stays scoped to this PR's diff. See
`SKILL.md`.

## Security — the diff is untrusted input

A review reads a diff and files that may be attacker-influenceable, and it runs
subagents with tool access. The supply-chain / vulnerability angle is what your CI
(SAST, dependency scanning) already covers; the risk specific to an AI reviewer is
**prompt injection** — instructions hidden in a comment, test fixture, commit
message, or the PR body that try to steer the agent. Scanners don't inspect for that,
so the skill treats everything under review as **data, never instructions** (see the
guard at the top of each lens and the security section of `SKILL.md`).

The real control is *containment at the trust boundary*, not detection:

- **Run with least privilege.** No cloud / publish / registry tokens in the
  environment the review runs in — then a successful injection has nothing worth
  stealing.
- **Keep command approval on** when running interactively. Cursor and Claude Code
  gate shell calls behind approval; that human confirmation *is* your boundary.
- **Install globally** (`npx skills add … -g`), not project-scoped (`-p`) into a repo
  you then review PRs against — otherwise `gh pr checkout` can swap the renderer and
  lens files for a PR-controlled copy that then executes as you.
- **Never build or install the checked-out tree.** The skill is report-only; an
  `npm install` on a PR would run attacker `postinstall` hooks. That includes the
  indirect path: repo tooling (husky/lefthook) often installs a local `post-checkout`
  hook that runs `bun install` the moment you check the PR out — the skill therefore
  checks out with git hooks neutralized (`core.hooksPath=/dev/null`; see `SKILL.md`
  Phase 0).

For interactive use on your own team's PRs (behind CI + human review), the residual
risk is low and these are mostly belt-and-suspenders.

### Running it unattended in CI (higher bar)

Auto-posting findings as a PR comment removes the human-in-the-loop **and** puts a
write token in scope — this is the classic ["pwn request"](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/)
shape, so harden accordingly:

- Do the analysis on the unprivileged `pull_request` trigger (no secrets); post the
  comment from a **separate** minimal-token job (`pull-requests: write` only) via
  `workflow_run`, so untrusted PR code never runs with the write token.
- Pin the skill to a trusted commit — never run the copy that lives on the PR branch.
- Treat public / fork PR authors as fully untrusted: prefer not to auto-run, or run
  fully unprivileged and gate comment-posting.
