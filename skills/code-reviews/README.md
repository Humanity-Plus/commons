# The Review Toolkit

An AI code-review loop for PRs and branches: a multi-lens reviewer that produces a
self-contained HTML report, a fixer that safely resolves the findings, a publisher
that posts the review to GitHub as one real review, a review-debt filer, and a
primitives-map generator. Built for the failure modes of **agent-written code** —
plausible reinvention, vacuous tests, green-CI-wrong-behavior — and evolved through
23 field-feedback rounds on production repos before going public.

> *"Both #148 and #112 would have shipped without fixing their stated bug, and both
> had green CI."* — a batch run's verdict, three PRs in

## The loop, in 60 seconds

```text
/review-pr 482          lenses → skeptic verify → severity arbiter → report.html
/review-fix             same pipeline, no HTML → fixes applied on your branch,
                        every added test mutation-tested (seen red before trusted)
/review-issues          non-blocking findings → grouped, deduped review-debt issues
/publish-review         the findings → ONE GitHub review (inline comments + body)
/map-primitives         generate the primitives.yaml map the primitives lens reads
```

Nine lenses look at one diff independently — bugs (`first-five`), repo conventions
with a Fowler-smell fallback (`conventions`), dependency audit (`warm`), test gaps
(`zombies`), deploy checklist (`preflight`), claim-vs-diff (`intent`), contract
tracing across area/platform/library boundaries (`seams`), system-shape
classification against a primitives map (`primitives`), and a feature-area triage
that plans the run. Every finding then survives an adversarial verify pass
(mechanical command checks first, skeptic subagents for judgment calls) and a
severity arbiter before it reaches you.

## What makes it different

- **Verification is the product.** Claims are settled by command output, vendor
  source, or experiments on your own checkout — never by a model re-reading its own
  reasoning. Verifiers may shrink claims, never grow them; escalations re-enter as
  findings with the enabling line quoted.
- **Trust follows ownership.** Your PRs (including your automation's) get baseline
  checks, fix-verification, and materialized-merge gates; anyone else's checkout is
  never executed, built, or installed.
- **Cost scales with the diff.** A one-line change is reviewed inline; a 4,000-line
  multi-area PR shards by feature area with per-area risk tiers — the tier ladder is
  a table of mechanical predicates, not judgment.
- **Findings teach.** Reports are written for the junior dev seeing the code for the
  first time: mechanism, proof, fix, takeaway — with diagrams where a picture beats
  prose.

## Install

See the [repo README](../../README.md): `npx skills add Humanity-Plus/commons`
(editable files, any agent) or the Claude Code plugin (managed bundle). Pick one.

## Setup that pays off

1. Commit a **`REVIEW.md`** at your repo root — [`REVIEW.example.md`](skills/review-pr/REVIEW.example.md)
   is the skeleton, [`REVIEW.worked-example.md`](skills/review-pr/REVIEW.worked-example.md)
   shows what a mature one looks like after months of real reviews.
2. Run **`/map-primitives`** once to generate `primitives.yaml` — the primitives
   lens then flags every PR that invents a shape your system already has.
3. Optional: the [pre-PR hook](hooks/README.md) blocks `gh pr create` until a fresh
   review exists — the harness enforces it, so agents can't skip it.

## Guide & internals

- **[review-toolkit.html](review-toolkit.html)** — the full user guide: command
  reference, scenarios, safety model.
- **[EVOLUTION.md](EVOLUTION.md)** — why the SKILL.md reads like a flight log: the
  field-feedback loop this toolkit is built by, and how to contribute a change.
- **[CHANGELOG.md](CHANGELOG.md)** — the round-by-round history.

## Credits

The lens method is adapted from the [unlearn.dev skill library](https://github.com/unlearndev/skills).
The primitives lens and the visual recap follow [Kent C. Dodds](https://github.com/kentcdodds/kcd-skills)'
primitives/visual-recap patterns. The conventions lens's smell baseline is Fowler's
*Refactoring* (ch. 3). The spec-discovery ladder and smell-catalog framing take
cues from [mattpocock/skills](https://github.com/mattpocock/skills). MIT, like the
rest of the Commons.
