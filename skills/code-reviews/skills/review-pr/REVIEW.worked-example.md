# Review instructions — a worked example

This is a lightly sanitized version of the `REVIEW.md` from one of our production
apps (a single-package SaaS: Convex backend, TanStack Start web app). It shows what
a *mature* review context looks like after a few months of real reviews — every line
below earned its place by killing a repeat false positive or catching a real bug
class. Start new repos from `REVIEW.example.md` (the skeleton) and let yours grow
toward this shape.

---

# Review instructions

Repo-level guidance for code review (human or agent, e.g. the `review-pr` skill).
Project rules live in [docs/conventions/](docs/conventions/README.md) — frame
findings against those actual rules and cite them; prefer `[Convention]` /
`[Known gap]` framing over generic advice. Read the convention files covering the
diff's area **fully** before reviewing:

- Web UI → [react.md](docs/conventions/react.md), [typescript.md](docs/conventions/typescript.md)
- Routes, data loading, auth gating → [tanstack-start.md](docs/conventions/tanstack-start.md)
- Backend (`convex/`) → [convex.md](docs/conventions/convex.md)
- Tests (or missing tests) → [testing.md](docs/conventions/testing.md)

## What Important means here

Reserve high-severity ("Important") for findings that break behavior, leak data, or
block a rollback: incorrect logic, unscoped/unbounded queries, PII in logs or error
messages, auth holes on a real trust boundary (a Convex function missing the
current-user check or the ownership guard), manual edits to release-owned files.
Structure, readability, naming, and refactoring suggestions are low/nit at most.

## Do not report

- **Anything CI already enforces** — lint/format/import order, type errors, and
  test-suite breakage all run on every PR. Missing or weak coverage for *changed*
  code is still fair game.
- **Generated code** — `convex/_generated/**` and `src/routeTree.gen.ts`. Always skip.
- **Historical documents** — `docs/specs/` and `docs/reports/` are point-in-time
  artifacts, not living docs; don't flag them as outdated.
- **PRs are sometimes stacked** (merged bottom-up onto each other). A gap in one PR
  may already be handled by a descendant PR in the stack — check before flagging.

## Always check

- **Auth and ownership on every new/changed backend function**: caller resolved
  server-side, tenant-scoped access through the shared ownership guard, internal-only
  functions not exposed as public. ([convex.md](docs/conventions/convex.md))
- **Args validators** on every public function; bounded user strings; indexed reads
  (no unbounded `.collect()`). ([convex.md](docs/conventions/convex.md))
- **Backend logic is covered with `convex-test`**, including the unauthenticated and
  not-owner branches; prefer asserting on thrown-error messages (e.g.
  `/invalid or expired/i`) over just the happy path.
  ([testing.md](docs/conventions/testing.md))
- **Release automation invariants** (Important if violated): no manual `"version"`
  bump in package.json, no manual CHANGELOG.md edits, PR title is a conventional
  commit — it becomes the squash-merge commit message the release tooling reads.
  (AGENTS.md → Versioning)
- **ADR present** for architectural decisions: technology choices, new patterns,
  breaking changes, build/deploy changes. ([docs/ADR/README.md](docs/ADR/README.md))
- **No PII in logs, error messages, or telemetry** (frontend PII collection is
  deliberately off).
- **Never mutate the build output directory after build** — post-build asset edits
  once truncated every JS file in production and caused a full client outage; the
  invariant is now a named rule reviews enforce.
- **Auth configuration hardening on any PR touching the auth setup files**
  (Important if violated): trusted origins stay pinned to exactly the site URL
  (never a wildcard or a second origin); rate limiting stays enabled with durable
  storage (in-memory storage inside a serverless isolate is no limit at all);
  session-cookie flags are never loosened from the framework defaults; token
  lifetimes and JWT algorithms stay pinned; every new auth-relevant endpoint gets an
  entry in the auth audit map — an invisible auth surface is the bug.
- **Reference consumers of shared infrastructure** — compare new code against these
  instead of accepting a re-implementation: `convex/tasks.ts` is the reference
  consumer of the ownership guard and shared validators; `convex/waitlist.ts` is the
  reference for rate-limited public endpoints and the idempotent
  `withIndex().first()` → `insert()` pattern; `src/components/tasks/` is the
  reference for component tests (jsdom pragma + Testing Library).

## Stack

Areas a review scorecard should grade (only those a PR touches): Convex, auth,
TanStack Start/Router/Query, React 19, TypeScript, Tailwind CSS v4, Security,
Performance, Tests (Vitest + convex-test + Testing Library).

## Repo facts

- Single-package app — backend in `convex/`, web app in `src/`, no monorepo. Bun
  toolchain, Biome for lint/format, deployed on Railway.
- Tests are colocated: `convex/*.test.ts` (convex-test) and `src/**/*.test.tsx`
  (jsdom pragma + Testing Library). No E2E yet — flag gaps as informational.
- Versioning is fully automated by release tooling; squash-merge PR titles are the
  changelog input.
- The app is auth-gated and agents can't sign in themselves, so browser-verification
  gaps may be explicitly declared in PRs — treat a declared gap as context, not a
  finding.

## Style

Soft preferences (low/nit — don't block on these): keep React files under ~350
lines and promote reusable sibling components to their own files; keep logic out of
`.map()` JSX callbacks; avoid unchecked `as` casts outside a validation boundary;
file naming follows the surrounding folder (repo currently mixes PascalCase and
kebab-case — never a finding beyond nit).

## Review roles

- arbiter: strongest
- verify: fast
