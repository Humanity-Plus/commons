---
name: map-primitives
description: Map a product repo's system primitives into a canonical docs/primitives.md (+ machine-readable primitives.yaml) and detect primitive drift — the same concept re-declared in multiple shapes across schema, validators, API surfaces, and UI. Covers all seven primitive areas (data, API, auth, workflows, agent tools, UI, infra), with data primitives as the deep default. Use when asked to "map primitives", bootstrap or refresh a primitives doc, audit a repo for primitive drift, or before building review tooling that needs a domain-model ground truth. Two modes: bootstrap (no map yet → inventory, drift report, write the map + AGENTS.md rule) and refresh (map exists → verify it against code, update it, report new drift). Documents honestly ("Known loose ends") rather than silently fixing; consolidation lands as separate follow-ups.
---

# Map primitives

A **primitive** is the smallest unit of meaning a system exposes — a
composable piece other code (and agents) build with instead of re-implementing
(Kent C. Dodds' framing). That is broader than the data model. Primitives live
in seven areas, and the failure mode of each missing area is different:

| Area | Examples | Without it, agents… |
|---|---|---|
| **Data** | entities, relationships, status enums, lifecycles | guess at shapes and relationships; ad-hoc duplicates |
| **API / backend** | resources + the verbs on them (approve, cancel, commit) | re-implement logic per call site; drifting duplicates |
| **Auth & trust** | roles, permissions, ownership guards, audit trail | hand out god-mode paths; skip guards inconsistently |
| **Workflows** | retriable/transactional capabilities, handshakes, schedulers | hand-roll orchestration differently every time |
| **Agent tools** | callable tools (MCP), skills, scripts | write one-off bash; irreproducible actions |
| **UI / design** | components, tokens, spacing, confirm/report patterns | invent colors, spacing, and dialog patterns per screen |
| **Infra / platform** | deploy targets, secrets, storage, cron, release flow | guess at operations; touch things they shouldn't |

**Default depth:** map the **data primitives** deeply (they anchor everything
else and suffer the worst drift), and cover the other six areas as an explicit
index — each area names its primitives, source-of-truth locations, and
invariants, even if only a few lines each. An area with no entry reads as
"unmapped", never as "doesn't exist".

Agents work by pattern-matching: when a primitive's canonical shape isn't
cheap to find, every session re-invents it slightly differently. This skill
produces the artifact that stops that: one canonical map, backed by single
source-of-truth modules in code.

**The end state this skill drives toward:**

1. Every primitive's *values* (statuses, categories, kinds, tiers) are defined
   exactly once in code, and every surface (schema, mutation/route validators,
   API tool schemas, UI types) derives from that definition by import.
2. `docs/primitives.md` (or `docs/project/primitives.md` if the repo has a
   `docs/project/`) maps every primitive: definition, source-of-truth file,
   lifecycle, relationships, surfaces — and lists known deviations honestly.
3. `docs/primitives.yaml` — the machine-readable companion review tooling
   consumes (see *Machine-readable map* below). Optional on first pass;
   required before wiring primitives into PR review.
4. The repo's agent instructions (AGENTS.md / CLAUDE.md) carry the standing
   rule: *extend the source-of-truth module, never re-declare primitive
   values inline; update the map in the same PR that changes or introduces
   a primitive.*

**What this skill does NOT do by default:** consolidate the drift it finds.
The doc PR documents reality, including the ugly parts, under *Known loose
ends*. Consolidation is separate follow-up work (file issues / task chips /
propose PRs) unless the user explicitly asks for fix-and-document in one pass.
Reason: consolidation changes runtime behavior (validators reject what they
used to accept) and often needs data migrations; the map should not be held
hostage by that.

## Mode selection

- No primitives doc in the repo → **bootstrap**.
- Doc exists → **refresh**: verify every claim against code (file paths,
  enum values, lifecycle states), update what changed, and report drift that
  appeared since. Never trust the existing doc — code wins.

## Step 1 — Inventory (parallel exploration)

Spawn parallel Explore subagents rather than reading serially. Cover four
angles; each reports with file:line references:

**a. Storage schema** — wherever entity shapes are declared:
- Convex: `convex/schema.ts` (tables, `v.union(v.literal(...))` enums,
  `v.string()` fields whose values live in a *comment* — a top drift signal).
- Prisma: `schema.prisma` (models, native enums).
- Drizzle / SQL: table definitions, `pgEnum`, CHECK constraints, migrations.
- Mongoose/other: model definitions.

**b. Shared vocabulary modules** — where the healthy pattern already lives:
`shared*.ts`, `constants/`, `enums/`, zod schemas reused across layers. These
are the existing sources of truth; the map points at them, and drifted
concepts should eventually move into this pattern.

**c. Surfaces** — every place a primitive is exposed or re-typed:
MCP tool JSON schemas, HTTP/tRPC/GraphQL route validators, frontend types and
hand-written unions, select/dropdown option lists, badge/label config maps,
identifier generators.

**d. Existing docs** — README, AGENTS.md/CLAUDE.md, docs/ (architecture,
reference, glossary, ADRs). Note where docs contradict code.

**e. Area sweep (breadth pass)** — one pass over the six non-data areas, each
answering "what are the named primitives, where do they live, what are the
invariants": auth (roles, guard helpers, permission checks), API verbs
(named operations beyond CRUD — approve, commit, cancel), workflows
(handshakes, schedulers, retry/transaction helpers), agent tools (MCP tools,
skills, scripts), UI (token system, component library, mandated patterns like
the repo's confirm-dialog rule), infra (deploy target, secrets, cron, release
automation). A few bullets per area is enough; the goal is that nothing
load-bearing is unnamed.

## Step 2 — Drift detection

Check each primitive against this list of drift shapes (all observed in real
repos). Report every hit with file:line for each declaration site:

1. **Re-declared value sets** — the same status/category union written out in
   N places (schema + mutation args + API schema + frontend union). Grep for
   a distinctive literal (e.g. `"in_review"`) across the whole repo; more
   than one *declaration* site (ignore comparisons/usages) is drift.
2. **Untyped-with-comment** — a plain string field whose legal values exist
   only in a comment or in UI config. Worst case: different surfaces disagree
   on the value count (backend knows 4, UI renders 5).
3. **Duplicated view-model / entity types** — the same shape independently
   declared in backend and frontend, free to diverge silently.
4. **Identifier-format drift** — the format in comments/docs vs. what
   generators actually produce.
5. **Doc-vs-code drift** — reference docs listing entities or values that
   don't match the schema, or missing entire subsystems.
6. **Derived-vs-stored confusion** — a computed status (derived from
   children) that some code path stores or shadows.
7. **Retired values still accepted** — legacy literals kept for old rows;
   fine if documented with a migration exit, drift if silent.

Severity-rank the findings: value-set *disagreement between surfaces* (a
writer can produce what a reader can't handle) is a latent bug, above mere
duplication.

## Step 3 — Write / refresh the map

Follow this template — all repos should converge on the same shape. Sections,
in order:

1. **Header + the rule.** State the never-re-declare rule and the code-wins
   clause: *"When code and this document disagree, code wins — and the
   disagreement is a bug in this document; fix it."*
2. **Primitive index table.** Columns: `Primitive | Table(s)/Model(s) |
   Source of truth for values | Surfaces` (UI / API / MCP / internal). Every
   entity in the schema appears — no "partial snapshot" maps.
3. **Relationship diagram(s).** ASCII tree or mermaid for the containment
   hierarchy; one per major cluster.
4. **Per-cluster sections.** For each primitive with real behavior: one-line
   definition, lifecycle as a mermaid `stateDiagram-v2` (only if it has one),
   invariants ("at most one active session per user", "feature status is
   derived, never stored — do not add a column"), identifier formats, and
   which agent-facing guardrails exist (e.g. "agents may set draft/in_review,
   never approve").
5. **Other primitive areas.** One short section per non-data area from the
   area sweep (auth & trust, API verbs, workflows, agent tools, UI, infra):
   named primitives, source locations, invariants. Brief is fine; absent is
   not.
6. **Known loose ends.** Every drift finding you are *not* fixing in this PR,
   phrased as "don't copy this" with the tracked exit (migration needed,
   follow-up filed).

Style rules for the doc:
- **Point, don't duplicate.** Name the constant and its module; only inline
  the values where it genuinely aids comprehension, and always beneath a
  named code source. A doc that re-enumerates everything rots like the code
  did.
- Keep it one file, skimmable, under ~200 lines. It's a map, not a spec.

## Machine-readable map (`docs/primitives.yaml`)

The markdown map is for humans and agents reading prose; review tooling needs
structure. Alongside the doc (first pass optional, required before wiring
primitives into PR review), emit `docs/primitives.yaml`:

```yaml
primitives:
  - id: prd            # stable slug, referenced by review tooling
    area: data          # data | api | auth | workflows | agent-tools | ui | infra
    name: PRD
    sources:            # source-of-truth files for the primitive's shape,
                        # values, derived vocabulary, and the guards that
                        # enforce it — not files that merely consume it
      - convex/sharedPrds.ts
      - convex/schema.ts
    invariants:
      - Agents may set draft/in_review but never approve.
      - Approval requires every section ready or n/a, at least one ready.
    relates_to: [product, requirement, feature]
```

**The `sources` contract — this map's one load-bearing definition.** The
review lens that consumes this file classifies anything primitive-shaped
*outside* every `sources` list as an `adds` (highest risk), so what belongs in
`sources` must match what the lens counts as primitive-shaped: the shape and
values, yes, but also **derived vocabulary** (an option order or label list
computed from the values) and **the guards that enforce the primitive** (a
validator module, a test the docs cite as the enforcement, an import
boundary). Files that merely *consume* the primitive stay out. A narrower list
isn't a tidier map — it's a map that flags its own repo forever (field: four
of five PRs in one run had their most important file map to zero primitives,
each a guard or derived vocabulary the map's author didn't think of as
"shape + values").

Keep ids stable — downstream review recaps (Kent C. Dodds' `visual-recap`
pattern) map changed file paths onto these ids via `sources`, classify each
touched primitive as **composes** (uses existing primitives — low risk),
**extends** (changes one — medium), or **adds** (introduces a new one — high;
in an agent-written PR this is also the "did it just invent a shape?" alarm),
and call out any touched `invariants` explicitly. The yaml duplicates the
doc's *pointers*, never the primitive *values* — values stay in code.

## Step 4 — Wire it into agent instructions

Add to AGENTS.md (or CLAUDE.md if that's the repo's convention), under its
hard-gates/requirements section:

> Domain primitives (entities, status enums, lifecycles) are mapped in
> docs/primitives.md. Before adding or typing a domain concept, check the map
> and extend its source-of-truth module — never re-declare a primitive's
> values inline in schema fields, mutation args, API schemas, or frontend
> types. When a primitive changes — or a new one is introduced — update the
> map in the same PR, or state in the PR why it stays unmapped.

If an existing reference/architecture doc overlaps, add a pointer from it to
the map ("authoritative domain map: …") rather than maintaining two.

## Step 5 — Report and hand off

Deliver to the user, in this order:
1. The drift findings, severity-ranked, each with its declaration sites.
2. What the map documents as loose ends vs. what's clean.
3. Proposed follow-ups (one per consolidation, smallest first) — file them as
   issues/task chips per the repo's workflow; recommend which to do first
   (usually: the surface-disagreement bugs).
4. The PR with the doc + instructions rule (docs-only, safe to merge ahead of
   any consolidation).

## Guardrails

- Code wins over any doc, including the one you're writing.
- Don't invent primitives that aren't in code, and don't editorialize the
  domain model — map what exists.
- Schema-tightening is never part of the mapping PR: validating stored fields
  against live data can fail deploys; that path needs a migration first.
- Refresh mode must re-verify file paths and values it inherits — a map that
  confidently points at moved files is worse than no map.
