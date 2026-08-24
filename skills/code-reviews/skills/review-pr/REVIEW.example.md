# Review instructions

Copy this to **`REVIEW.md` in your repo root** and commit it. One file, two readers:

- The **`review-pr` skill** reads the whole file (from the **base branch** in PR mode)
  and threads it into every lens, the verify pass, and the verdict.
- **Claude Code Review** reads a root `REVIEW.md` automatically and injects it into its
  review agents.

So the same brief drives both — no per-tool duplication or drift. Keep it factual,
specific, and **self-contained** (neither tool expands `@`-imports — put rules inline).
It is guidance about the repo, **not** a place to blanket-approve PRs or suppress whole
classes of real bugs. Delete the sections you don't need; length dilutes the rest.

## What Important means here

Reserve high-severity ("Important") for findings that break behavior, leak data, or
block a rollback: incorrect logic, unscoped/unbounded queries, PII in logs or error
messages, auth/authz holes on a real trust boundary. Structure, readability, naming,
and refactoring suggestions are low/nit at most.

## Do not report

- **Greenfield — no production environment yet.** No live database or prod deploy, so
  "missing migration / no backward-compatible fallback / breaking data-format change"
  is moot. Note at most as informational.
- **Auth is not wired up yet.** Endpoints/functions intentionally run without authn/authz
  for now; "missing auth check" is expected and tracked separately.
- **Anything CI already enforces** — lint, formatting, import order, type errors —
  **as long as those checks pass on the branch under review**. If the branch
  currently fails a CI-enforced rule (common on stale branches), that's a merge
  blocker, not noise.
- **Generated code** under `packages/backend/convex/_generated/` — always skip.
- **We stack PRs** (Graphite here — Sapling/`ghstack`/`spr`/manual chains are the same).
  A gap in this PR may already be handled by another PR in the stack — before flagging,
  check the descendant/parent PRs for a revert or fix. (The skill auto-detects stacks
  from GitHub base branches; this note just guarantees it and helps in local mode.)

## Always check

Rules this repo commits to (the `conventions` lens flags violations, citing the source):

- **Money** is stored in integer minor units — a "float amount" is always a bug.
- `ctx.db.get` throws on a malformed id — treat that as a real defect, not a nitpick.
- Backend logic is covered with `convex-test`; prefer asserting on thrown-error
  messages (e.g. `/invalid or expired/i`) over just the happy path.
- Project rules live in `docs/conventions/**` and `AGENTS.md` — frame findings against
  those actual rules and cite them; prefer `[Convention]` / `[Known gap]` framing over
  generic advice. Read the files covering the diff's area **fully** before reviewing
  (e.g. web UI → `react.md`; backend → `convex.md`; routes/forms → `tanstack-start.md`).
- **Reference consumers of shared infrastructure** — name them so reviews compare
  against them instead of accepting a re-implementation (e.g. `identity_control` is
  the reference consumer of the shared image-upload stack; a new consumer must reuse
  it, not re-solve it). List the high-signal rules reviews keep missing here too —
  this section is the positive rubric, not just the false-positive filter above.

## Stack

Areas the `conventions` scorecard grades (only those a PR touches show up): Convex,
Better Auth, TanStack Start, React, TypeScript, Security, Performance, Tests.

## Repo facts

- Internal service-to-service calls behind the gateway are trusted; only validate input
  that crosses a true trust boundary (user → API).
- Folder/file naming is `snake_case` under `packages/backend/convex/`.

## Style

Soft preferences (low/nit — don't block on these): keep React files under ~350 lines and
promote reusable sibling components to their own files; keep logic out of `.map()` JSX
callbacks; avoid unchecked `as` casts outside a validation boundary.

## Review roles

<!--
  Optional: reassign the review-pr skill's subagent roles to model capability tiers
  (fast | balanced | strongest). Roles: triage, lens, seams, verify, arbiter, holistic
  — defaults and what each does are in the skill's SKILL.md. Tiers resolve to whatever
  models the host tool offers, so this survives model churn; an exact model id also
  works but will go stale. Delete this section to use the defaults.
-->

- arbiter: strongest
- verify: fast
