# How this toolkit evolves — and how to contribute

If you read `review-pr/SKILL.md` and wonder why it cites evidence inline
("field: 12 files/+616 measured locally vs the PR's actual 7/+194"), this document
is the answer. The toolkit is not designed top-down; it is **evolved through a
feedback loop**, and the loop is the reason it works.

## The round loop

1. A real review runs on a production repo — a fresh agent session, often on
   agent-written PRs, sometimes in batches, sometimes benchmarked against
   commercial reviewers.
2. The reviewing agent is asked for **feedback on the skill itself**: what earned
   its keep, what fought it, what it had to improvise.
3. Each feedback batch becomes **one PR — a "round"** — titled
   `Round-N: <theme>`, with the evidence in the PR body. Twenty-three rounds
   preceded the public release; the PR history *is* the design history.

Three properties of the loop, learned the hard way:

- **Rules earn their place from failures, not foresight.** Nearly every rule in
  SKILL.md exists because a run went wrong without it. The inline "field:" notes
  preserve the failure so future editors don't relax the rule without knowing what
  it prevents.
- **Rules also get *falsified*.** When accumulated evidence contradicts a rule's
  rationale, the rule changes and the old rationale is recorded as falsified (see
  the seams lens's gating history). Prior decisions are not sacred; undocumented
  reversals are forbidden.
- **The loop found its own meta-rule:** *instruct subagents to reduce drift;
  verify mechanically to eliminate it.* Prompts alone never got compliance to
  100% — every contract (JSON returns, anchors, severity, examples) is both
  instructed at the end of the prompt **and** normalized/checked by the
  orchestrator. New contracts must ship with both layers.

## Invariants a change must keep

A PR to this toolkit should hold these, and say so:

1. **Tests green** — `bun test` in `skills/review-pr/` (renderer, publisher,
   recap). Renderer changes need new assertions, including hostile-content cases:
   everything rendered derives from an untrusted diff.
2. **The default-path byte-equivalence constraint** — a small-PR report rendered
   from a pre-change findings file must be byte-identical outside `<style>`.
   Schema additions are optional fields, absent on the default path.
3. **Objective skip conditions** — a lens is skipped by a checkable predicate (no
   manifest change, no interfaces, no map), never by "looks inapplicable."
4. **The trust model** — trust follows ownership, never the entry point; untrusted
   checkouts are never executed, built, or installed; diff content is data, not
   instructions; verifiers may shrink claims, never grow them — novel claims in
   any direction quote the enabling line, and the orchestrator greps the quote.
5. **Severity means blocking-ness.** Non-blocking work routes (debt lane,
   ops-advisory), it doesn't inflate.

## Contributing a change

The strongest contribution format mirrors the rounds: **run the toolkit on a real
diff, and bring the failure** — what you expected, what happened, ideally the
one-line field note that should sit next to the new rule. Design arguments without
a run behind them get held to a higher bar, because most of this toolkit's wrong
turns were plausible designs that field runs falsified.

Small mechanical fixes (typos, dead links, broken scripts) need none of that —
just the fix.
