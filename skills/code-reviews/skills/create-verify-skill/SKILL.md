---
name: create-verify-skill
description: >
  Generate — or refresh — a repo-local `verify-<app>` skill that drives the real
  app the way a user does and proves a feature by its observable end state:
  launch, doctor, drive, evidence, cleanup, plus a feature map (one file per
  user-facing feature, with the source paths that implement it and the seeded
  personas it needs). The review toolkit consumes it: review-pr's experiment
  bucket, resolve-review's post-fix verification, and loops built on them
  drive the features a change touched. Use when asked to "create a verify skill", "make a
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
- Loops built on those two (a PR queue, for instance) drive the affected
  features before landing a PR.

You write the generated skill **for the next agent, not for a human**: it is
read cold, mid-task, by an agent that has never seen the app. Every line must
be executable as written — real commands, real selectors, real paths, no
placeholders.

## Mode selection

- No verify skill in the repo → **bootstrap** (sections 1–5).
- One exists → **refresh** (section 6). Several distinct ones → ask which; the
  user names the app.
- An explicit `refresh` argument forces refresh mode; with no verify skill
  present it stops and says so instead of bootstrapping.

**Detection — one rule, shared with every consumer.** A verify skill is a
`SKILL.md` found by

```sh
find . -path '*/skills/verify-*/SKILL.md' -not -path '*/node_modules/*'
```

with a sibling `features/README.md`. It is `find -path`, not a shell glob:
the host skill directories start with a dot, and a `*` glob skips those.
Resolve symlinks and dedupe by real path (several hosts may point at one
skill); several *distinct* matches means several apps — ask which one.

## Preconditions

- **Your own checkout only.** Bootstrap builds, seeds, and starts the app
  and may touch the tree to make it start; refresh drives it. That is the
  same execution trust `resolve-review` demands: a branch you own, never a
  colleague's or a fork's PR checkout (`gh pr view --json author` against
  `gh api user` when in doubt). The recipes you write become "the sanctioned
  way to run the app" for `review-pr`, so they must come from a tree you
  trust.
- **A local or disposable instance only.** The generated Launch starts an
  instance from the repo's own seed (or an environment the repo documents
  as disposable), and Drive signs in only as seeded test personas. A repo
  with no local run path gets a skill that says its features are unprovable
  locally — never one that drives a shared, staging, or production
  deployment.

**Where the skill lives — the host's project skill directory, detected not
assumed.** Each agent host discovers project skills at its own path:
`.claude/skills/` (Claude Code), `.cursor/skills/` (Cursor), `.codex/skills/`
(Codex), `.agents/skills/` (the skills CLI's shared location). Write to the
directory the repo **already has**; when it has none, write to the current
host's and say so; when it has several, write once and symlink the others so
one map stays the source of truth (the detection rule dedupes by real path).

## 1. Interview the repo, not the user

Answer these from the codebase; ask the user only what the repo can't tell you:

- **Surface.** What does a user touch — a web UI, a CLI or TUI, a desktop app,
  an API, a mobile app, a library? Pick the primary surface; note the rest.
- **Run.** How does the app start locally? The repo's own documented dev
  command first (`package.json` scripts, `Makefile`, the README quickstart).
  Ports, env vars, seed data, auth, migrations. And what a **fresh worktree**
  lacks: a worktree materializes tracked files only, so gitignored env files,
  per-checkout deployments, and caches the main checkout has are missing
  there — find the repo's own worktree setup script, or the copy step, that
  provides them.
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
  state from an empty data dir. Shell state does not survive between an
  agent's tool calls, so Launch starts the instance in the background and
  **records every pid it started in `$(git rev-parse --git-dir)/verify/.pids`**,
  and the readiness wait is **bounded** —
  a stated timeout after which Launch runs Cleanup and reports the instance
  never became usable, instead of a hand-rolled sleep loop. For a short-lived
  CLI or TUI there is no server: launch means build once, then each drive
  starts in its own isolated session. Any identifier Launch **derives** from
  the environment — a deployment or database name, a port, a cache key built
  from the checkout path or branch — is sanitized to the target's allowed
  charset before use. Worktree and temporary-directory names carry
  underscores, dots, and mixed case that deployment names reject (field: an
  underscore in a temp dir failed Launch before the process started).

  **Runtime state lives in the git dir, never under `review-report/`.** The
  pid file, the port, the head the instance was built from, its log, and any
  registered client an external service rate-limits all go in
  `$(git rev-parse --git-dir)/verify/` — per worktree, never committed, and
  outside the directory the review toolkit moves aside for checks and
  archives between runs. State that must outlive a worktree (a registered
  OAuth client, when registration is limited per hour) goes one level up in
  `$(git rev-parse --git-common-dir)/verify/`, shared by every worktree of
  the repo. `review-report/verify/` holds **evidence only** (field: a pid
  file kept beside the evidence was archived with another PR's findings
  while its instance was still running, so Doctor and Cleanup lost the
  server and the next run re-registered the client).

  **Launch works from a fresh worktree.** The toolkit runs in worktrees, and a
  worktree materializes tracked files only. Launch names what a fresh worktree
  lacks — gitignored env files, a per-checkout deployment or database, caches —
  and runs the repo's own command that provides them before the first start (a
  worktree setup script when the repo has one, a documented copy step
  otherwise), so a run in a worktree no setup hook touched still reaches
  usable (field: a repo's worktree setup script existed and its verify skill
  never named it, so every fresh-worktree run had to rediscover it).
- **Doctor.** One read-only check that answers "is this instance worth
  driving?" — process up, right build, port owned by us, auth valid, seed
  present — and it prints every identifier Launch derived, so a refusal
  reads as one. An agent runs it first whenever anything looks off.
- **Personas.** One entry per seeded user state: a name, what state the seed
  puts them in, how to sign in as them (the seed file and key, by reference),
  and what they are for. The empty-state persona and the edge-case persona
  earn their place here; a feature map that only knows the happy-path user
  proves only happy paths.
- **Drive.** The harness recipe with this repo's real selectors, commands, and
  routes. Prefer stable handles — ARIA labels, data attributes, prompt strings,
  route paths — over coordinates and tab order.
- **Evidence.** What to capture for a proof and where it goes:
  `review-report/verify/<feature>/<phase>-<sha7>/`, where `<phase>` names who
  ran it (`bootstrap`, `refresh`, `review`, `resolve`, `queue`) and `<sha7>`
  is the head the run proved — so a later phase can compare against an
  earlier one instead of overwriting it, and the ledger's evidence path is
  unambiguous. Evidence survives cleanup. **Before the first write, make sure
  `review-report/` is ignored** — the review toolkit does it in its workspace
  reset, but a bootstrap is often the first toolkit run in a clone:

  ```sh
  git check-ignore -q review-report || echo "review-report/" >> "$(git rev-parse --git-common-dir)/info/exclude"
  ```

  The proof standards: exercise the real user path, not internal setters or
  test-only endpoints; capture the action and the resulting state, not just
  the final screen; verify side effects (rows written, files created, messages
  sent) alongside what is visible; mocks only where a production boundary
  already isolates the external system. When the safe path is a dry-run or
  test mode, verify what it actually skips by observing files, network, and
  git refs, rather than trusting its name. **Redact what evidence may carry**:
  never capture the credential-entry step itself, and strip `Authorization`,
  `Set-Cookie`, and token fields from saved response bodies and transcripts —
  evidence is read by people and agents long after the run.
- **Cleanup.** Tear down what the run created: read the pid file Launch
  wrote, confirm each pid is still the process you started, kill those, and
  remove the file. Never kill by process name or port. Cleanup removes
  instances and the per-run scratch state in the git dir, never the evidence
  and never the shared, rate-limited registrations.
- **Helpers.** Any script the skill ships is executable and its invocation
  appears in the skill body. A helper the reader has to reverse-engineer is
  not a helper.

## 3. Write the feature map

Create `verify-<app>/features/README.md` — an index, one line per feature —
plus one file per user-facing feature, from routes, commands, menus, and docs.
Start with the top three to five; the map grows in refresh mode. Each feature
file has exactly these H2s, in this order:

1. **Paths** — the source files and directories that implement the feature,
   repo-root-relative, one per line, no globs; a directory entry matches
   every path under it (the same rule as the primitives map's `sources`).
   This is the join key the toolkit uses: a change's file list intersects
   these paths — a changed file matches when it equals an entry or lies under
   a directory entry — to find the features the change touched. A feature
   with no paths is unreachable to every consumer; name at least the entry
   points.

   **A file listed by several features narrows by symbol.** Shared modules (a
   users table, an auth helper) sit under many features' Paths, and a plain
   file join drives every one of them for a change most cannot observe (field:
   a three-file refactor of a shared helper selected eight journeys). When a
   changed file is listed by more than one feature, a feature stays only when
   another of its changed Paths matched directly, or one of its Paths
   references an export the diff changed — the changed export itself, or an
   export of the same file whose body calls it (`grep -l` the names across the
   feature's other Paths entries). The rest are recorded as `not-affected`,
   with the file and the exports checked, so the record shows what was skipped
   and why. A file listed by one feature always drives it.
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
state, no way to isolate instances). Tell the user the review toolkit now
consumes the skill — `resolve-review` drives touched features after its
fixes, `review-pr` uses the recipes on owned checkouts, and loops built on
them (a PR queue) drive the rest of a change's reach — and that a refresh run
keeps the map honest as the app changes. Offer the AGENTS.md rule *"when a PR
adds or changes a user-facing feature, update its file under
`verify-<app>/features/` in the same PR"*; the review's `conventions` lens
then cites it, and the fixer repairs drift its own branch caused in that same
PR (pre-existing drift goes to a refresh).

## 6. Refresh mode

A feature map rots the moment the app changes. The unit of rigor is the
feature, not every sentence: cover every feature file from source, exercise
every feature live, prepare at most one set of proven corrections. The
Preconditions above apply: your own checkout, a local instance.

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
   personas added or removed since the map was written. Re-read the skill's
   own Launch, Doctor, and Cleanup against section 2's contract — pid file
   and runtime state in the git dir, bounded wait, the fresh-worktree setup
   step, derived identifiers sanitized and printed by Doctor — a
   section written before a contract rule existed is harness drift, fixed
   under the helpers rule (field: a generated Launch kept deriving a
   deployment name from the raw checkout path after the generator learned to
   sanitize it).
4. **Live pass — required even when source looks clean.** Follow the skill's
   own launch model. Doctor before the first drive, after any failed drive,
   and on each fresh session where sessions are the unit. Exercise every
   feature at least once, with the personas its file names. Evidence survives
   every cleanup, checked at its location. Nothing a drive started outlives
   the drive. A feature that can't be reached is `unreachable` only
   with the concrete prerequisite and the route attempted; a prerequisite the
   map omits is drift. Final teardown after the last drive.
5. **Triage.** Wrong or missing user-POV description or paths → doc drift,
   fix it. Working behavior the harness can't drive → harness gap, fix it
   under the helpers rule. App behavior that is broken → product gap: record
   it for the user, keep it out of this PR.
6. **Outcome, one of three, stated:** `clean` (every feature covered from
   source and live, nothing to change), `changed` (the proven corrections
   applied in the working tree, every changed file re-read, reported as a
   diff — a branch, commit, or PR only when the invocation asked for one;
   opening a PR is a visible action, so it is never the default), `blocked`
   (coverage could not finish or a proven fix could not land safely — say
   exactly what blocked it).

## Rules

- **Executable as written.** No placeholders survive into the generated
  skill; every command, selector, and path came from this repo.
- **Credentials by reference.** The skill names the seed file and key that
  holds a persona's login; it never contains the value.
- **Never weaken a journey to make it pass.** A failed journey with its reason
  in Gotchas is the honest output.
- **Stop what you start.** Every instance the generator or the generated
  skill launches is torn down by pid before the run ends, evidence intact.
- **Local instances, seeded personas, your own checkout** — the
  Preconditions are rules for the generated skill too; it refuses a live
  target rather than driving one.
- **Product code is out of scope** in refresh mode, and in bootstrap it is
  touched only to make a broken checkout start, reported as such.
