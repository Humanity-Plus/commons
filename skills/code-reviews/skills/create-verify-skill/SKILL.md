---
name: create-verify-skill
description: >
  Generate — or refresh — a repo-local `verify-<app>` skill that drives the real
  app the way a user does and proves a feature by its observable end state:
  launch, doctor, drive, evidence, cleanup, plus a feature map (one file per
  user-facing feature, with the source paths that implement it and the seeded
  personas it needs). The review toolkit consumes it: review-pr's experiment
  bucket, resolve-review's post-fix verification, and pr-queue drive the
  features a change touched. Use when asked to "create a verify skill", "make a
  verification skill for this repo", "map the features", or when a repo has no
  scripted way to prove UI, CLI, or service behavior; in refresh mode when asked
  to "refresh the verify skill" or "audit the feature map". Two modes: bootstrap
  (no verify skill yet → interview the repo, generate, prove it end to end once)
  and refresh (exists → source readers per feature, one live pass, corrections
  only — never product code).
---

# Create a verify skill

`review-pr` reads the diff. A **verify skill runs the app.** The toolkit has
had no scripted way to do the second thing, so every experiment, probe, and
post-fix check reinvented "how do I start this app and get to that screen" from
scratch, mid-task, in an agent that had never seen the app. This skill writes
that knowledge down once, as a repo-local skill tailored to the repo, and the
rest of the toolkit consumes it:

- `review-pr`'s experiment bucket and the blast-radius probe use its launch
  and drive recipes on owned checkouts instead of ad-hoc `node -e`.
- `resolve-review` drives the features a review touched after its fixes land
  and attaches the evidence to the resolution ledger.
- `pr-queue` drives the affected features before landing a PR.

You write the generated skill **for the next agent, not for a human**: it is
read cold, mid-task, by an agent that has never seen the app. Every line must
be executable as written — real commands, real selectors, real paths, no
placeholders.

## Mode selection

- No `verify-*` skill in the repo → **bootstrap** (sections 1–5).
- One exists (a project skill whose body has a Launch section and a sibling
  `features/README.md`) → **refresh** (section 6). Several candidates → ask
  which; the user names the app.

**Where the skill lives — the host's project skill directory, detected not
assumed.** Each agent host discovers project skills at its own path:
`.claude/skills/` (Claude Code), `.cursor/skills/` (Cursor), `.codex/skills/`
(Codex), `.agents/skills/` (the skills CLI's shared location). Write to the
directory the repo **already has**; when it has none, write to the current
host's and say so; when it has several, write once and symlink the others so
one map stays the source of truth. The consumers detect the skill by shape,
not by path: any `*/skills/verify-*/SKILL.md` with a sibling
`features/README.md`.

## 1. Interview the repo, not the user

Answer these from the codebase; ask the user only what the repo can't tell you:

- **Surface.** What does a user touch — a web UI, a CLI or TUI, a desktop app,
  an API, a mobile app, a library? Pick the primary surface; note the rest.
- **Run.** How does the app start locally? The repo's own documented dev
  command first (`package.json` scripts, `Makefile`, the README quickstart).
  Ports, env vars, seed data, auth, migrations.
- **Seed and personas.** Where does seed data come from (`seed.ts`, fixtures,
  a `db:seed` script, a snapshot)? Which **users** does it create, in which
  **states** — a plain user, an admin, a user with an empty account, a user
  mid-workflow, an expired trial, an edge case the code special-cases? Those
  are the **personas**: a feature can only be proven for the states the seed
  makes reachable, so the personas are part of the feature map, not an
  afterthought. Read credentials from the repo's seed or example-config files
  by reference; never write a credential value into the skill.
- **Drive.** How can an agent interact programmatically? Existing harnesses
  first — Playwright or Cypress specs, expect scripts, PTY helpers, curl-able
  endpoints, a debug port. Only then a generic recipe: a browser-automation
  harness or the host's own browser tools for web and Electron, a tmux or PTY
  session for CLI and TUI, plain HTTP for services.
- **Observe.** What evidence can be captured? Screenshots, terminal
  transcripts, response bodies, logs, exit codes, database state.
- **Isolate.** Can two instances run side by side (ports, data dirs,
  profiles)? If not, the generated skill says so and refuses to double-drive
  a shared instance — corrupting the user's session is worse than skipping.

If the checkout doesn't build or start as-is, fix that first or report it
precisely before generating; a skill written against a broken base teaches
wrong steps. When an irrelevant missing asset blocks startup (a static
directory the API never serves, a sample config), the generated skill may
create it, labeled as verification scaffolding, and remove it in cleanup.

## 2. Generate the skill

Write `verify-<app>/SKILL.md` with YAML frontmatter — `name: verify-<app>` and
a `description` naming the app, the surface, and when to reach for it; without
frontmatter the skill never registers in any host — and these sections, each
grounded in what the interview found:

- **Launch.** The exact command that starts the app for verification and how
  to tell it is **usable**, not merely answering: the log line or prompt that
  means migrations and seed ran. A database health check passes while its init
  scripts are still running; wait for the real signal. Launch reaches a usable
  state from an empty data dir. Include teardown. For a short-lived CLI or TUI
  there is no server: launch means build once, then each drive starts in its
  own isolated session.
- **Doctor.** One read-only check that answers "is this instance worth
  driving?" — process up, right build, port owned by us, auth valid, seed
  present. An agent runs it first whenever anything looks off.
- **Personas.** One entry per seeded user state: a name, what state the seed
  puts them in, how to sign in as them (the seed file and key, by reference),
  and what they are for. The empty-state persona and the edge-case persona
  earn their place here; a feature map that only knows the happy-path user
  proves only happy paths.
- **Drive.** The harness recipe with this repo's real selectors, commands, and
  routes. Prefer stable handles — ARIA labels, data attributes, prompt strings,
  route paths — over coordinates and tab order.
- **Evidence.** What to capture for a proof and where it goes:
  `review-report/verify/<feature>/` (git-ignored, survives cleanup). The proof
  standards: exercise the real user path, not internal setters or test-only
  endpoints; capture the action and the resulting state, not just the final
  screen; verify side effects (rows written, files created, messages sent)
  alongside what is visible; mocks only where a production boundary already
  isolates the external system. When the safe path is a dry-run or test mode,
  verify what it actually skips by observing files, network, and git refs,
  rather than trusting its name.
- **Cleanup.** Tear down what the run created. Never kill by process name —
  kill what you started, by pid. Cleanup removes instances and scratch state,
  never the evidence.
- **Helpers.** Any script the skill ships is executable and its invocation
  appears in the skill body. A helper the reader has to reverse-engineer is
  not a helper.

## 3. Write the feature map

Create `verify-<app>/features/README.md` — an index, one line per feature —
plus one file per user-facing feature, from routes, commands, menus, and docs.
Start with the top three to five; the map grows in refresh mode. Each feature
file has exactly these H2s, in this order:

1. **Paths** — the source files and directories that implement the feature.
   This is the join key the toolkit uses: a review's changed files intersect
   these paths to find the features a change touched. A feature with no paths
   is unreachable to every consumer; name at least the entry points.
2. **Personas** — which personas (from the skill's Personas section) this
   feature needs, and which state each must be in. A journey that needs a
   state the seed doesn't provide **fails and says why** in Gotchas; never
   weaken the journey to make it pass.
3. **How to get to it (user POV)** — the route a user takes, in user terms.
4. **Driving it with ‹harness›** — the exact commands or selectors, per
   persona where they differ.
5. **Proof** — the observable end state that proves it works: what is on
   screen, what was written, what was sent. Not "no error".
6. **Gotchas** — preconditions, flakiness, seed limits, what a failed journey
   reported and why.

A proof that drives one convenient entry point is incomplete when the map
lists others. The map is the repo's maintained verification source.

## 4. Prove the generated skill before handing it over

Run its own instructions end to end once: launch, doctor, sign in as one
persona, drive **one** mapped feature (one is enough — the map exists so later
runs cover the rest), capture evidence, clean up. After cleanup confirm the
evidence still exists at its named location; a cleanup that eats the proof
fails this step. Fix what fails, and run the generated cleanup after every
failed iteration too, so broken attempts don't strand processes and ports.
**A generated skill that was never executed is a draft, not a deliverable.**
If you proved it in a stand-in for the real target (a container for a fresh
VM, a local stack for a remote one), list every setup step the stand-in did
that the target will not; those stay unverified until a run on the target
covers them.

## 5. Hand over

Report: where the skill lives, the personas found, the features mapped (and
the user-facing surfaces you saw but didn't map yet), the feature you drove and
where its evidence is, and anything the repo made unprovable (no seed for a
state, no way to isolate instances). Tell the user the toolkit now consumes
the skill automatically — `resolve-review` and `pr-queue` drive touched
features, `review-pr` uses the recipes on owned checkouts — and that a refresh
run keeps the map honest as the app changes. Offer the AGENTS.md rule *"when
a PR adds or changes a user-facing feature, update its file under
`verify-<app>/features/` in the same PR"*; the review's `conventions` lens then
cites it.

## 6. Refresh mode

A feature map rots the moment the app changes. The unit of rigor is the
feature, not every sentence: cover every feature file from source, exercise
every feature live, ship at most one PR of proven corrections.

**Edit scope: the verify skill's own directory only.** Never edit product code
during a refresh. A behavior the map describes that the app no longer does is
either doc drift (fix the map) or a product regression (report it to the user;
keep it out of the corrections).

1. **Index hygiene.** Read `features/README.md` and glob its siblings. Fix
   missing, extra, duplicate, or dead entries.
2. **Source wave.** One read-only subagent per feature file, in parallel. Each
   explains how the feature works from source, checks the file's **Paths**
   against where the code actually lives, flags likely drift with citations,
   and returns one live-verification recipe. Readers never drive the app and
   never edit files.
3. **Reconcile.** Every feature file has a returned summary. Spot-check cited
   drift; don't re-prove clean claims. Sweep recent churn (`git log` since the
   last refresh) for user-facing surfaces missing from the map — a concrete
   source path is required before calling one missing. Check the seed for
   personas added or removed since the map was written.
4. **Live pass — required even when source looks clean.** Follow the skill's
   own launch model. Doctor before the first drive, after any failed drive,
   and on each fresh session where sessions are the unit. Exercise every
   feature at least once, with the personas its file names. Evidence survives
   every cleanup, checked at its location. Nothing a drive started outlives
   the drive. A feature that can't be reached is `verified-unreachable` only
   with the concrete prerequisite and the route attempted; a prerequisite the
   map omits is drift. Final teardown after the last drive.
5. **Triage.** Wrong or missing user-POV description or paths → doc drift,
   fix it. Working behavior the harness can't drive → harness gap, fix it
   under the helpers rule. App behavior that is broken → product gap: record
   it for the user, keep it out of this PR.
6. **Outcome, one of three, stated:** `clean` (every feature covered from
   source and live, nothing to ship — no branch, no PR), `changed` (one PR of
   proven corrections, every changed file re-read first), `blocked` (coverage
   could not finish or a proven fix could not ship safely — say exactly what
   blocked it).

## Rules

- **Executable as written.** No placeholders survive into the generated
  skill; every command, selector, and path came from this repo.
- **Credentials by reference.** The skill names the seed file and key that
  holds a persona's login; it never contains the value.
- **Never weaken a journey to make it pass.** A failed journey with its reason
  in Gotchas is the honest output.
- **Stop what you start.** Every instance the generator or the generated
  skill launches is torn down by pid before the run ends, evidence intact.
- **Product code is out of scope** in refresh mode, and in bootstrap it is
  touched only to make a broken checkout start, reported as such.
