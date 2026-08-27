# Writing a finding (educational, article style)

This is the shared house style for the `evidence` and `suggestion` fields of every
finding. The orchestrator gives it to each finding-producing lens (first-five,
conventions, intent, zombies, preflight, warm). Follow it whenever you write those two
fields.

## Audience

Assume the reader is a **competent junior developer seeing this code for the first
time**. Your job is not just to flag the problem — it's to make them understand *why*
it's a problem and leave them a little wiser. Explain the mechanism, not only the
symptom. Never condescend; never pad.

## Structure — a short article, not one block

`evidence` should read like a tight explainer with whitespace, not a wall of text.

1. **Lede (1–2 sentences):** what's wrong, in plain language, before any jargon.
2. **`## What the code does`** — quote the offending code in a fenced block and
   describe what actually happens.
3. **`## Why it breaks` / `## Why it matters`** — the mechanism and the impact. Is it
   guaranteed or edge-case? What's the blast radius? For security, spell out the
   trade-off (e.g. "the TTL is how long a stolen cookie stays valid").
4. **`## Evidence`** — the `grep`/`ls`/type output or cross-file check that *proves*
   the claim. Show, don't assert.

Keep paragraphs to 2–4 sentences with blank lines between them. Not every finding
needs all four sections — a `medium` might be a lede + one section — but a
`critical`/`high` usually earns the full treatment.

## Formatting the renderer rewards

- **File/line refs:** write `` `src/pay/charge.ts:42` `` in backticks → renders as a
  blue monospace permalink with the line number highlighted. Always prefer this to
  "line 42".
- **Inline code:** backtick every symbol, method, value, env var — it gets a tinted
  chip that stands out from prose and from file refs.
- **Code / proof blocks:** ```` ```ts ````, ```` ```text ````, etc. Use ```` ```diff ````
  for before/after — added lines go green, removed go red. **Write literal
  characters inside fences** — `<Button`, `&&`, `>` exactly as they appear in the
  code, never HTML-escaped (`&lt;Button` renders literally as `&lt;Button`).
  Escaping is the renderer's job; pre-escaping breaks every downstream surface.
- **bold** for the one thing that matters most; *italic* for a light aside.

## Visualizations — you have real HTML, not just Markdown

The report is HTML, so `evidence`/`suggestion` accept **native HTML + inline CSS**
(sanitized). When a picture beats prose, hand-write it. Shipped components (styled
for the report theme; use the `class` names as-is):

- **Diagram** — inline `<svg>` inside `<figure class="diagram">…<figcaption>…</figcaption></figure>`
  for flows, box-and-arrow, state machines, before/after. This is the big win over
  Markdown.
- **Callout** — `<div class="callout danger|warn|note|ok"><div class="callout-title">Impact</div>…</div>`
  to spotlight blast radius or a gotcha.
- **Columns** — `<div class="cols">…two children…</div>` (or `cols-3`) for side-by-side
  before/after or option comparisons.
- **Badge** — `<span class="badge red|green|amber|blue">fails</span>` for inline status.
- **Panel** — `<div class="panel">…</div>` to group; plus plain `<table>`, `<details>`,
  `<blockquote>`, `<kbd>`, `<mark>`.
- A pipe table (`| input | expected | actual |`) is still the quickest comparison.

Use a visual only when it clarifies; don't decorate. Anything unsafe you write
(`<script>`, `onclick`, `javascript:`, remote `url()`) is stripped by the sanitizer,
so stay within these components and it renders as authored.

**Keep HTML blocks well-formed.** The `mdToHtml` renderer in `render.ts` treats a line
starting with a tag as a raw HTML block and consumes lines — including internal blank
lines — until that block's **root tag is closed** (`</figure>`, `</div>`, `</svg>`, …).
So a multi-line SVG or a `cols`/`callout` with blank lines between children is fine, as
long as every block you open is closed. An *unclosed* root tag will swallow the rest of
the field, so always pair your tags.

## Findings-only runs — the compact index is what travels

When the orchestrator tells you this is a **findings-only run** (no HTML report will
be rendered — the consumer is a fix phase like `resolve-review`, not a human reading
a report), the pipeline owns the format, not you:

- **Write your full findings array to the file path the orchestrator gives you**
  (`review-report/lenses/<lens>.json`). Write your natural, complete findings there
  — but skip the visual components (no `<svg>`, `cols`, `callout`, `badge`;
  nobody renders them in this mode). **The disk file carries the FULL findings
  (complete `evidence`/`suggestion` prose); the message carries the compact
  index. If disk and message contain the same thing, you've done it backwards** —
  the disk file is what the orchestrator hydrates from when the compact form
  isn't enough.
- **Return only the compact index** as your final message — a raw JSON array with
  one entry per finding:
  `{ id, severity, category, file, line, title, claim, mechanism, fix }`,
  where `claim` is a single sentence stating the asserted defect **and includes a
  short quote of the offending code** (the anchor check greps for it),
  `mechanism` is one sentence on **why** it breaks, and `fix` is one sentence
  stating the **proposed remedy**. The index is what the verify and fix phases
  actually work from — make those three sentences carry the finding.
- Keep `` `file:line` `` refs and backticked symbols everywhere — the fixer
  navigates by them.

The orchestrator assembles the handoff from the compact indexes and reads your full
finding from disk only when the fix needs more context. When no mode is stated,
default to the full report style above.

## The `suggestion` field

Give the concrete fix — a ```` ```diff ```` or numbered steps — then a **one-line
takeaway** naming the general lesson, so the reader avoids the whole class of bug
next time (e.g. *"lean on the SDK's types to catch a typo'd method before it ships"*).

## Example (evidence)

> Stripe's Node SDK groups calls by resource, and the method that finalizes a charge
> is `capturePaymentIntent()`. There is no `captureIntent()` — so this can never run.
>
> \#\# What the code does
>
> `src/pay/charge.ts:42` calls a method that doesn't exist:
>
> ```ts
> const res = await stripe.captureIntent(intentId); // not a function
> ```
>
> \#\# Why it always breaks
>
> JavaScript only notices a missing method *when the line runs*, so it slipped past
> review and now throws on every capture.
>
> | Call | In the SDK? | Result |
> | --- | --- | --- |
> | `stripe.captureIntent(id)` | no | `TypeError` at runtime |
> | `stripe.capturePaymentIntent(id)` | yes | captures the charge |

## Example (authored HTML — a diagram + a callout)

```html
<figure class="diagram">
<svg viewBox="0 0 480 70" xmlns="http://www.w3.org/2000/svg" font-size="12">
  <rect x="6" y="20" width="150" height="30" rx="6" fill="#16171e" stroke="#7ec2ff"/>
  <text x="81" y="39" text-anchor="middle" fill="#d5d7e0">request</text>
  <line x1="158" y1="35" x2="212" y2="35" stroke="#9a9daa" stroke-width="1.5"/>
  <rect x="316" y="20" width="150" height="30" rx="6" fill="#3a1c1e" stroke="#ff8589"/>
  <text x="391" y="39" text-anchor="middle" fill="#ffb0b3" font-weight="700">TypeError</text>
</svg>
<figcaption>Every request funnels through the one bad call.</figcaption>
</figure>

<div class="callout danger">
  <div class="callout-title">Impact</div>
  Because <b>every</b> capture runs this line, the feature fails 100% of the time.
</div>
```

Keep `title` a single plain-text line — no HTML/Markdown there.

**The no-anchor convention:** a finding that isn't about a specific location (a
deploy step, a repo-wide observation) uses `file: "", line: 0` — never an
arbitrary "representative" anchor. A wrong anchor is worse than none: it survives
normalization when the file exists, and sends the fixer to code that isn't the
subject.
