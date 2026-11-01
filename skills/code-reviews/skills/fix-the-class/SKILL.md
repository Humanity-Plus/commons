---
name: fix-the-class
description: >
  Invoke as /fix-the-class after the user corrects an agent for a mistake
  the repo has seen before ("again", "I keep telling agents", "make this
  impossible", "harden the repo"), or for a standing hardening pass over a
  repo's recurring agent mistakes. Finds the mistake classes from the repo's
  own evidence, then makes each one impossible at the highest level that
  works — architecture, types, a check whose error names the fix, a test —
  with prose rules last. `resolve-review` follows the same procedure for a
  review finding marked as a class. Restructures the repo, so explicit
  invocation only.
disable-model-invocation: true
---

# Fix the class

The user corrected an agent for something this repo has been corrected for
before. Fixing the instance is how the same mistake costs three rounds. Change
the repo so the next agent cannot make it.

Assume every future contributor is an agent that sees only the files it
opened, copies the nearest example, and takes the shortest path that compiles.
Design the repo so a change that looks right from one file is right for the
whole repo.

Three entry points, same procedure:

- **One correction, just now.** Fix the mistake, then run steps 1 to 4 for its
  class only. The correction is the first piece of evidence; the second is
  what you find in step 1.
- **A hardening pass.** Steps 1 to 4 over every class step 1 finds, most
  frequent first.
- **A class finding from a review.** `review-pr` marks a finding with
  `classEvidence` when the same mistake sits at several sites in one diff, a
  cited rule rests on prose, or a past review found it before; `resolve-review`
  fixes every site in its scope and then follows steps 2 to 4 for that class
  at the guard levels (types, a check, a test), proven red on the instance it
  just fixed — in place, by re-applying the defect and restoring; from a
  review nothing is committed and no scratch worktree is used, so step 3's
  "one class per commit" reads "one class per discrete change" there. Step 1
  is already done: the finding is the evidence. An architecture move is
  reported for its own PR, never applied from a review.

## 1. Find the mistake classes

Read the record before you guess. A class counts once the same mistake has
happened **twice**, and every class carries its evidence: the commit, PR
comment, finding, or note that shows it.

Where the repeats are written down:

- Recent commits and reverts. A fix-up commit, a revert, or a commit message
  that says "again" or "also" names a class.
- Review threads on recent PRs, and the review toolkit's own record: archived
  `review-report/` findings, the lens JSON under `review-report/lenses/`, the
  findings a review marked with `classEvidence`, and the issues labelled
  `review-debt` that `review-issues` filed. The same finding category across
  independent PRs is a class.
- A PR-queue run's recurring-findings ledger and its root-cause issues.
- The repo's `AGENTS.md`: every entry under **Known Issues** and **Agent
  Notes**, and every rule that nothing enforces. A rule that is only prose is
  a class waiting to repeat, whether or not it has yet.
- Comments that explain a workaround, and `// eslint-disable`,
  `@ts-expect-error`, `as any` and their kin: each one marks a place where the
  shortest path did not compile and someone forced it.

Group by **what the agent got wrong**, not by file. "Re-declared a status enum
inline" is a class; "touched `schema.ts`" is not.

## 2. Pick the highest level that works

For each class, try the levels in this order and stop at the first one that
makes the mistake impossible:

1. **Architecture.** Give each piece of state one owner and each task one
   supported way. Hide internals so the wrong import fails to resolve.
   Replace hand-synced lists with one source of truth and derive the rest.
   Delete the old way and the dead code an agent would copy.
2. **Types.** Make the bad state unrepresentable, so the wrong code does not
   compile.
3. **A check whose error names the fix.** When bad code still compiles, a
   lint rule, a test over the repo's own files, or a script in CI that fails
   with the file, type, or function to use instead. An error that says "do
   not do X" without "do Y here" is half a guard. When the pattern is already
   widespread, ratchet: count the occurrences and fail only when a change
   adds one.
4. **A test on the behavior.** For a class of wrong behavior rather than
   wrong structure. While here, fix or delete any test that still passes when
   the behavior it names breaks, or that fails when only internals change;
   those are the tests agents learn from.
5. **Docs or an agent rule.** Last, and only for judgment calls that no check
   can decide. Nothing fails when an agent skips prose.

Two guards on the ladder:

- **Smallest change that makes the mistake impossible.** "Architecture first"
  is a priority, not a license to refactor. If the architecture move changes
  runtime behavior (validators reject what they accepted, an export
  disappears, a migration is needed) it lands as its own PR with its own
  proof, the same rule `map-primitives` has for consolidation; the guard at
  the next level down lands now so the class stops growing meanwhile.
- **Note why the higher levels did not work.** That reason goes in the report
  and, for a prose rule, in the rule table, so the next pass knows whether
  the level was a limit or a shortcut.

## 3. Fix and prove

One class per commit, most frequent first. Each new check gets the
mutation-test treatment the review toolkit already demands of fixes: **prove
it fails on a real past instance** before trusting it. Check out the
offending commit in a scratch worktree, or re-apply the reverted diff, or
restore the pre-fix example, and run the check there: red. Then on the
current tree: green. A check that was never seen red is a prose rule with a
longer name.

The check runs with the **same command locally and in CI**, so a local pass
means a CI pass; add it to the CI job where the repo's other checks run.

An exception to a check lives on the offending line with a reason, an expiry
date, and the name of the human who approved it. An exception without all
three is a workaround, and workaround comments are step 1 evidence.

Do not weaken anything to get green: no loosened assertions, no widened types,
no deleted test you have not read.

## 4. Keep the rule table

The repo's agent instruction file (`AGENTS.md`, or `CLAUDE.md` where that is
the convention) keeps a table that pairs each rule with what enforces it:

```markdown
## Rules and what enforces them

| Rule | Enforced by |
|---|---|
| Status values are declared once, in `src/domain/status.ts` | `bun test src/domain/status.test.ts` (fails on an inline enum) |
| Every feature file names its personas | `skills/verify-app/features.test.ts` |
| Prefer the smallest reproducing fixture | prose only: judgment call, see PR #112 |
```

The **Enforced by** cell is a command or a file path, or the words
`prose only` with the reason. Maintain it on every correction:

- **New correction, no row:** fix the mistake, add the row with its
  enforcer, and if the enforcer is `prose only`, say why nothing higher
  worked.
- **Correction matches a row that says `prose only`:** that is a repeat. The
  prose did not hold. Raise it to the highest level that works in the same
  change and replace the cell.
- **Correction matches a row with an enforcer:** the enforcer has a hole.
  Prove it with the mutation test, close the hole, keep the row.
- **A class the architecture now makes impossible:** drop the row, together
  with the check that enforced it if the check can no longer fail.

The rule table is the only part of this skill that is prose, and it exists
to show which rules still rest on prose. `review-pr`'s class mark (Phase 4,
after the arbiter) reads it too: a `conventions` finding that cites a repo rule
in a `prose only` row, or one the table does not list, is marked as a class,
which is what routes it back here.

## Report

For each class, in one block:

- The class, in one sentence, with its evidence (commit, PR, finding, note).
- The level picked, and why each higher level did not work.
- The proof: red on which past instance, green on which commit.
- The rule table rows added, raised, or dropped.

Lead with what you could not make impossible, and with any architecture move
you deferred to its own PR, so the reader knows what still rests on prose.

---

Adapted from `correct` in Lauren Tan's [pstack](https://github.com/poteto/pstack)
(MIT): the agent model, the level ladder, proof-on-a-past-mistake, and the
rule table are hers. This version adds the scope guard on the ladder, points
step 1 at this toolkit's own record of repeats (review-report archives,
`classEvidence` findings, review-debt issues, PR-queue ledgers, AGENTS.md
notes), names the proof as the mutation test the review toolkit already
requires, and gives `resolve-review` an entry point so a review's class
findings are hardened, not just fixed.
