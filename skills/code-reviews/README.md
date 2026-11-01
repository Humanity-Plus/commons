# The Review Toolkit

An AI code-review loop for PRs and branches: a multi-lens reviewer that produces a
self-contained HTML report, a fixer that safely resolves the findings, a publisher
that posts the review to GitHub as one real review, a review-debt filer, a
primitives-map generator, a verify-skill generator that teaches the toolkit
how to run your app, and a class hardener that makes a repeated mistake
impossible instead of fixing it again. Built for the failure modes of **agent-written code** —
plausible reinvention, vacuous tests, green-CI-wrong-behavior — and evolved through
23 field-feedback rounds on production repos before going public.

Built for Claude Code: the skills run `git`, `gh`, and `bun` against your local
checkout, so use them where Claude has a terminal and your repository.

> *"Both #148 and #112 would have shipped without fixing their stated bug, and both
> had green CI."* — a batch run's verdict, three PRs in

## The loop, in 60 seconds

```text
/review-pr 482          lenses → skeptic verify → severity arbiter → report.html
/publish-review         the findings → ONE GitHub review (inline comments + body)
/resolve-review         the findings → fixed code on your branch: scoped fixes,
                        every added test mutation-tested (seen red before trusted)
/review-issues          non-blocking findings → grouped, deduped review-debt issues
/review-fix             review-pr + resolve-review in one pass, no HTML — the
                        fast pre-PR loop on a local branch
/map-primitives         generate the primitives.yaml map the primitives lens reads
/create-verify-skill    generate a repo-local verify-<app> skill + feature map; the
                        review, the fixer, and loops built on them then drive the
                        features a change touched
/fix-the-class          make a repeated mistake impossible at the highest level that
                        works, proven red on a past instance; resolve-review runs
                        it for the findings a review marked as a class
```

**The recommended flow for a PR is the first three, in that order**: `/review-pr`
to find, `/publish-review` to put the findings on the PR, `/resolve-review` to fix
them. The resolve step is not a formality — it's where fixes are validated against
the repo's own gates and every new test is mutation-tested, so skipping it (or
hand-fixing from the comments) forfeits the toolkit's second verification layer.
For a branch that isn't a PR yet, `/review-fix` runs the same find-then-fix loop
in one pass.

Ten lenses look at one diff independently — bugs (`first-five`), repo conventions
with a Fowler-smell fallback (`conventions`), dependency audit (`warm`), test gaps
(`zombies`), deploy checklist (`preflight`), claim-vs-diff (`intent`), contract
tracing across area/platform/library boundaries (`seams`), system-shape
classification against a primitives map (`primitives`), the change's reach beyond
the diff and the one safety fact it rests on (`blast-radius`), and a feature-area
triage that plans the run. Every finding then survives an adversarial verify pass
(mechanical command checks first, skeptic subagents for judgment calls) and a
severity arbiter before it reaches you.

## What makes it different

- **Verification is the product.** Claims are settled by command output, vendor
  source, or experiments on your own checkout — never by a model re-reading its own
  reasoning. Verifiers may shrink claims, never grow them; escalations re-enter as
  findings with the enabling line quoted.
- **Trust follows ownership.** Your PRs (including your automation's) get baseline
  checks, fix-verification, and materialized-merge gates; anyone else's checkout is
  never executed, built, or installed — unless the repo's own `REVIEW.md` deliberately
  widens execution trust to write-access collaborators (`## Trust`, for teams
  reviewing each other's PRs; forks never qualify).
- **Cost scales with the diff.** A one-line change is reviewed inline; a 4,000-line
  multi-area PR shards by feature area with per-area risk tiers — the tier ladder is
  a table of mechanical predicates, not judgment.
- **Findings teach.** Reports are written for the junior dev seeing the code for the
  first time: mechanism, proof, fix, takeaway — with diagrams where a picture beats
  prose.

## Install

As a Claude Code plugin (managed bundle, skills namespaced as
`/humanity-plus-review:review-pr` etc.):

```bash
claude plugin install humanity-plus-review --marketplace Humanity-Plus/commons
```

Or as editable files for any agent with the skills CLI, as the
[repo README](../../README.md) describes. Pick one lane — installing both gives
you every skill twice.

## What it runs and sends

- **On your machine:** `git` and `gh` to read the diff and PR, check out the PR
  branch with git hooks disabled, fetch the base, and create scratch worktrees;
  `bun` to render the HTML report and run the publish and recap scripts; and the
  dependency lens's package-registry lookups and `npm audit`-style advisory queries. On your own branches it also runs
  the repo's tests and checks; it never executes, builds, or installs anyone else's
  checkout unless the repo's `REVIEW.md` opts in.
- **To GitHub, through your `gh` login:** the review and its comments
  (`publish-review`, after a dry run you confirm); review-debt issues, plus their
  label if the repo doesn't have it yet (`review-issues`); closing the review-debt
  issues a fix paid off (`resolve-review`, which edits your working tree and commits
  only when you ask); and, only when you ask, a system-recap block in the
  description of your own PR (`recap.ts --pr`).
- **Report hosting, only when you pass the flag:** `--gist` uploads `report.html` as
  a secret gist, which anyone with the link can open, and links it through the
  third-party viewer htmlpreview.github.io. `--pages <owner/name>` commits it to that
  repository so its GitHub Pages site serves it. Neither will put a non-public
  repository's report where anyone can read it unless you pass `--force-gist` or
  `--force-pages`.
- **When you open the report:** `report.html` loads its fonts from Google Fonts.
- **Nowhere else.** No telemetry and no other servers, and no token or key is ever
  read: GitHub access goes through your existing `gh` login.

## Setup that pays off

The [setup guide](https://www.humanityplus.solutions/commons/plugins#review-setup) walks through each step.

1. Commit a **`REVIEW.md`** at your repo root — [`REVIEW.example.md`](skills/review-pr/REVIEW.example.md)
   is the skeleton, [`REVIEW.worked-example.md`](skills/review-pr/REVIEW.worked-example.md)
   shows what a mature one looks like after months of real reviews.
2. Write your conventions down in **`docs/conventions/`**, one short file per
   topic — the conventions lens cites them rule by rule, and reports nothing it
   can't cite.
3. Run **`/map-primitives`** once to generate `primitives.yaml` — the primitives
   lens then flags every PR that invents a shape your system already has.
4. Optional: the [pre-PR hook](hooks/README.md) blocks `gh pr create` until a fresh
   review exists — the harness enforces it, so agents can't skip it.

## Guide & internals

- **[review-toolkit.html](review-toolkit.html)** — the full user guide: command
  reference, scenarios, safety model.
- **[EVOLUTION.md](EVOLUTION.md)** — why the SKILL.md reads like a flight log: the
  field-feedback loop this toolkit is built by, and how to contribute a change.
- **[CHANGELOG.md](CHANGELOG.md)** — the round-by-round history.

## Credits

The lens method draws on the [unlearn.dev](https://unlearn.dev) course; the wording
here is our own.
The primitives lens and the visual recap follow [Kent C. Dodds](https://github.com/kentcdodds/kcd-skills)'
primitives/visual-recap patterns. The conventions lens's smell baseline is Fowler's
*Refactoring* (ch. 3). The spec-discovery ladder and smell-catalog framing take
cues from [mattpocock/skills](https://github.com/mattpocock/skills). The
blast-radius lens — one load-bearing safety fact, an evidence ladder climbed by
proof rather than argument, cleared risks as output — adapts the `blast-radius`
skill in Lauren Tan's ([poteto](https://github.com/poteto)) MIT-licensed
[pstack](https://github.com/cursor/plugins/tree/main/pstack), in our own
phrasing and wired to this toolkit's trust model; the `interrogate` arg
adapts pstack's `interrogate` and `arena` skills the same way — adversaries
that must prove a finding with a run, kept only when a rerun reproduces it,
with model-family diversity where a second runner exists; and
`create-verify-skill` adapts pstack's `create-verification-skill` and
`maintain-verification-skill` — a generated, repo-local skill that drives the
real app with launch / doctor / drive / evidence / cleanup and a feature map
proven by observable end states — adding the paths join key and seeded
personas that let this toolkit's review, fixer, and queue consume it; and
`fix-the-class` adapts pstack's `correct` — the agent model, the level ladder,
proof on a past mistake, and the rule table — with a scope guard on the ladder
and an entry point from `resolve-review`'s class findings. The toolkit is
MIT-licensed, like the rest of the Commons.
