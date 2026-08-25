---
name: write-clearly
description: >
  Use when writing or revising prose meant for human readers — PR bodies,
  issue text, docs, READMEs, release notes, reports, published comments —
  or when asked to make a text clearer, tighter, or easier to follow.
  Cuts filler, hedging, and decoration so the reader gets the point in one
  pass. Clarity only — this skill never disguises agent authorship;
  attribution rules still apply.
---

# Write clearly

The goal is text a busy reader follows in one pass, without backtracking
and without wondering what a sentence actually claims. That is the whole
goal. This skill is **not** about making text look human-written: no
banned punctuation, no vocabulary blacklists, no manufactured
imperfections. If an agent wrote it, say so — attribution (see
`github-comment-attribution`, `create-pr`) and clarity are complements,
not competitors. Readers deserve both the truth about who wrote it and
prose that respects their time.

## Where it applies

Prose deliverables: PR descriptions, issue bodies, published comments,
docs, READMEs, release notes, reports, commit-message bodies. Not code —
the surrounding codebase's style governs there — and not text the user
wrote verbatim and asked you to post.

Two ways to run, same rules:

- **While writing** (the default): keep these rules in view and write the
  deliverable once. This costs nothing extra.
- **As an editing pass**: when asked to clarify existing text, rewrite it
  against the rules. Preserve every claim — clarity edits change how
  something is said, never what is said. If a passage is too vague to
  restate concretely, that is a question for the author, not a license to
  invent specifics.

## The test

Ask of every sentence: **what does it tell the reader to do or know?**
If the answer is a concrete instruction, fact, or number, keep it and
sharpen it. If there is no answer, cut the sentence. A useful second
check: if the sentence could appear unchanged in another project's docs,
it says nothing about this one.

## Rules

### Say something

- **State what happened, not its significance.** "A pivotal improvement
  to the review pipeline" → "Reviews now finish in one pass instead of
  three." If the significance is real, the facts carry it.
- **Name the source or cut the claim.** "It's widely considered best
  practice" → name who considers it, link it, or drop it.
- **Mechanism or number, not vibes.** "Feels much faster" names a
  feeling; "cold start dropped from 2.1s to 300ms" names a fact. When
  you can't measure, name the mechanism: "the index is now covering, so
  the query never touches the table."
- **No generic conclusions.** "This lays the groundwork for future
  improvements" → state the specific next step or end the text one
  sentence earlier.
- **Expand or delete trailing `-ing` claims.** "…, ensuring
  scalability" smuggles in an unargued claim. Either show how it ensures
  it, or delete the clause.

### One idea per sentence

- **Split dense sentences.** If the reader must backtrack to parse it,
  it's two sentences.
- **Active voice with a named actor.** "Queries are validated" → "the
  compiler validates queries." Passive is fine only when the actor is
  unknown or genuinely irrelevant.
- **Lead with the outcome.** First sentence of a PR body, doc section,
  or report answers "what happened" or "what should I do"; supporting
  detail follows for readers who want it.

### Fewer, plainer words

- **Cut filler.** "In order to" → "to"; "due to the fact that" →
  "because"; "it is important to note that" → delete.
- **Collapse hedging stacks.** "Could potentially possibly" → "may".
  One hedge is honesty; three is noise.
- **Prefer the plain word.** "Utilize" → "use"; "leverage" → "use";
  "facilitate" → "help"; "numerous" → "many". Precise technical terms
  are not fancy words — "idempotent" stays when idempotence is the
  point.
- **Plain "is" over dressed-up "is".** "Serves as", "stands as",
  "boasts", "features" → "is" or "has".
- **Adverb → stronger verb or a number.** "Significantly improves
  performance" → the measured delta, or at minimum "halves".
- **"Not just X, but Y" → say Y.** The contrast frame adds length, not
  meaning.
- **No false ranges.** "From auth to caching" implies a scale that
  doesn't exist; list the items.

### Formatting serves scanning

- **Bullets whose bold label restates the line are prose in disguise.**
  "**Performance:** performance improved…" → write the sentence. A bold
  lead-in followed by genuinely new detail is fine.
- **Structure only where it helps scanning.** Headings, tables, and
  bullets earn their place in reference material; a short answer or a
  simple PR body reads better as two paragraphs than as five sections.
- **Bold sparingly.** Emphasis on every proper noun means emphasis on
  nothing.

## What this skill deliberately leaves out

Unslop-style detection-evasion rules — em-dash bans, "AI vocabulary"
blacklists, adding deliberate mess, faking first-person opinions. Those
optimize for *not looking generated*, which is a different (and worse)
goal than being clear, and several of them actively damage clarity. If
the precise word for the thing is "primitive" or "surface", use it.
