// Safety regression tests for the rich-content sanitizer.
// Run: bun test  (from this directory)
import { test, expect } from "bun:test";
import { sanitizeHtml, renderInline, renderRich, page, validateReport } from "./render.ts";

// ---- structural validation (the round-13 "undefined · undefined confidence" fix) ----
test("validateReport rejects malformed-but-present shapes", () => {
  // the exact field-reported mistake: flat verdict + wrong meta type pass silently
  expect(validateReport({ verdict: "request-changes" }).join(" ")).toContain("verdict must be an object");
  expect(validateReport({ verdict: { confidence: "high" } }).join(" ")).toContain("verdict.decision is missing");
  expect(validateReport({ findings: { a: 1 } }).join(" ")).toContain("findings must be an array");
  expect(validateReport({ triage: { groups: "src" } }).join(" ")).toContain("triage");
  expect(validateReport("not a report").join(" ")).toContain("report root");
});

test("validateReport accepts valid reports and genuinely absent sections", () => {
  expect(validateReport({})).toEqual([]); // absent sections are the defaults' job
  expect(
    validateReport({
      meta: { title: "t" },
      verdict: { decision: "comment", confidence: "high", summary: "ok" },
      triage: { groups: [], skipped: [] },
      findings: [],
    })
  ).toEqual([]);
});

test("injected-quote payload cannot smuggle an event handler", () => {
  // Classic breakout attempt: a stray quote + a handler after a legit attribute.
  const payload = `<span title="foo" onmouseover=alert(1)>bar">click</span>`;
  for (const out of [sanitizeHtml(payload), renderInline(payload), renderRich(payload)]) {
    expect(out.toLowerCase()).not.toContain("onmouseover"); // handler name gone
    expect(out).not.toContain("alert(1)"); // handler value never emitted
    expect(out.toLowerCase()).not.toMatch(/on\w+\s*=/); // no on*= survives at all
    expect(out).toContain("click"); // benign text preserved
  }
});

test("event handlers on any tag are stripped, tag+text kept", () => {
  const out = sanitizeHtml(`<b onclick="steal()">x</b><div onmouseenter=alert(2)>y</div>`);
  expect(out.toLowerCase()).not.toMatch(/on\w+\s*=/);
  expect(out).not.toContain("steal()");
  expect(out).toContain("<b>x</b>");
  expect(out).toContain("y");
});

test("dangerous subtrees are dropped whole", () => {
  const out = sanitizeHtml(`ok<script>alert(1)</script><iframe src=https://e></iframe>done`);
  expect(out).not.toContain("<script");
  expect(out).not.toContain("<iframe");
  expect(out).not.toContain("alert(1)");
  expect(out).toContain("ok");
  expect(out).toContain("done");
});

test("javascript: and remote url() are neutralized", () => {
  const a = sanitizeHtml(`<a href="javascript:alert(1)">x</a>`);
  expect(a).not.toContain("javascript:");
  const s = sanitizeHtml(`<p style="color:red;background:url(https://e/x.png)">y</p>`);
  expect(s.toLowerCase()).not.toContain("url(https");
  expect(s).toContain("color:red"); // safe declaration survives; remote background dropped
});

test("safe HTML + SVG diagrams survive", () => {
  const out = sanitizeHtml(
    `<figure class="diagram"><svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#e5484d"/></svg></figure>`
  );
  expect(out).toContain('class="diagram"');
  expect(out).toContain("<svg");
  expect(out).toContain("viewBox="); // camelCase attribute preserved
  expect(out).toContain("<rect");
});

test("conventions scorecard + section render with cited rule", () => {
  const html = page({
    meta: { mode: "local", title: "t", base: "main", head: "feat", filesChanged: 1, additions: 1, deletions: 0 },
    verdict: { decision: "comment", confidence: "high", summary: "ok" },
    triage: { groups: [], skipped: [] },
    scorecard: [
      { area: "React", status: "warn", note: "One oversized file.", findingIds: ["conventions-1"] },
      { area: "TypeScript", status: "pass", note: "No unchecked casts." },
    ],
    findings: [
      {
        id: "conventions-1",
        lens: "conventions",
        severity: "low",
        category: "Structure",
        file: "src/big.tsx",
        line: 1,
        title: "File too large",
        evidence: "419 lines.",
        suggestion: "Split it.",
        featureArea: "UI",
        rule: "docs/conventions/react.md: files under 350 lines",
      },
    ],
  } as any);
  // Assert on structural signals, not exact heading copy, so wording can change freely.
  expect(html).toContain('class="scorecard"'); // scorecard card present
  expect(html).toContain('id="conventions"'); // dedicated findings section present
  expect(html).toContain("File too large"); // finding title flows through
  expect(html).toContain("react.md"); // cited rule surfaced
});

test("scorecard card is omitted when no scorecard is provided", () => {
  const html = page({
    meta: { mode: "local", title: "t", base: "main", head: "feat", filesChanged: 0, additions: 0, deletions: 0 },
    verdict: { decision: "approve", confidence: "high", summary: "clean" },
    triage: { groups: [], skipped: [] },
    findings: [],
  } as any);
  expect(html).not.toContain('class="scorecard"');
});

test("hostile HTML in a scorecard note / finding.rule is sanitized", () => {
  // scorecardCard renders `note` and findingCard renders `rule` through renderInline,
  // so exercising that path directly (isolated from benign page chrome) is the real check.
  const note = renderInline(`<script>alert(1)</script><img src=x onerror=alert(2)>note ok`);
  const rule = renderInline(`<script>steal()</script>docs/x.md<b onclick="bad()">gist</b>`);
  for (const out of [note, rule]) {
    expect(out).not.toContain("<script"); // dangerous subtree dropped whole
    expect(out.toLowerCase()).not.toMatch(/on\w+\s*=/); // no event handler survives
    expect(out).not.toContain("alert("); // handler/inline-script payload gone
    expect(out).not.toContain("steal()");
  }
  expect(note).toContain("note ok"); // benign note text preserved
  expect(rule).toContain("gist"); // benign rule text preserved (unsafe tag unwrapped)

  // And end-to-end: the same payloads must not surface as live markup in the page.
  const html = page({
    meta: { mode: "local", title: "t", base: "main", head: "feat", filesChanged: 1, additions: 1, deletions: 0 },
    verdict: { decision: "comment", confidence: "high", summary: "ok" },
    triage: { groups: [], skipped: [] },
    scorecard: [{ area: "React", status: "warn", note: `<img src=x onerror=alert(2)>note ok` }],
    findings: [],
  } as any);
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("alert(2)");
  expect(html).toContain("note ok");
});

// ---- new optional schema fields (area, locations, regradeNote, folded, source) ----

const baseReport = (over: Record<string, unknown> = {}) =>
  ({
    meta: { mode: "local", title: "t", base: "main", head: "feat", filesChanged: 1, additions: 1, deletions: 0 },
    verdict: { decision: "comment", confidence: "high", summary: "ok" },
    triage: { groups: [], skipped: [] },
    findings: [],
    ...over,
  } as any);

const mkFinding = (over: Record<string, unknown> = {}) => ({
  id: "first-five-1",
  lens: "first-five",
  severity: "medium",
  category: "Input Boundaries",
  file: "src/a.ts",
  line: 10,
  title: "Unguarded optional",
  evidence: "e",
  suggestion: "s",
  featureArea: "Core",
  ...over,
});

test("grouped finding renders as one card listing every location", () => {
  const html = page(
    baseReport({
      findings: [
        mkFinding({
          locations: [
            { file: "src/a.ts", line: 10, note: "add the `?? []` fallback here" },
            { file: "src/b.ts", line: 20 },
            { file: "src/c.ts", line: 30, note: "<script>bad()</script>guard the map call" },
          ],
          regradeNote: "Grouped: same defect class at 3 sites.",
        }),
      ],
    })
  );
  expect(html).toContain('class="loc-list"'); // one card, one location list
  expect(html).toContain("×3 occurrences"); // group-size chip
  expect(html).toContain("b.ts"); // every occurrence listed
  expect(html).toContain("c.ts");
  expect(html).toContain("Regraded"); // regrade note surfaced
  expect(html).toContain("same defect class at 3 sites");
  expect(html).toContain("fallback here"); // per-site note rendered
  expect(html).toContain("guard the map call"); // note text survives…
  expect(html).not.toContain("<script>bad()"); // …but hostile markup in it does not
  expect((html.match(/class="loc-note"/g) || []).length).toBe(2); // only noted sites get one
  expect((html.match(/<article class="finding"/g) || []).length).toBe(1); // exactly one card
});

test("folded findings move to the collapsed More-findings section", () => {
  const html = page(
    baseReport({
      findings: [
        mkFinding({ id: "a-1", title: "Lead finding" }),
        mkFinding({ id: "a-2", title: "Folded nitpick", severity: "nitpick", folded: true }),
      ],
    })
  );
  expect(html).toContain('id="more-findings"'); // collapsed section present
  expect(html).toContain("Folded nitpick"); // folded finding still rendered…
  const mainSection = html.slice(html.indexOf('id="findings"'), html.indexOf('id="more-findings"'));
  expect(mainSection).toContain("Lead finding");
  expect(mainSection).not.toContain("Folded nitpick"); // …but not in the main section
});

test("meta.holistic renders the comparison card with counts and holistic-only list", () => {
  const html = page(
    baseReport({
      meta: {
        mode: "local", title: "t", base: "main", head: "feat", filesChanged: 1, additions: 1, deletions: 0,
        holistic: { lensesOnly: 4, holisticOnly: 1, both: 2 },
      },
      findings: [
        mkFinding({ id: "h-1", lens: "holistic", title: "Cross-cutting retry bug", source: "holistic" }),
        mkFinding({ id: "a-1", title: "Lens finding", source: "both" }),
      ],
    })
  );
  expect(html).toContain("Holistic comparison");
  expect(html).toContain('class="holi-stats"');
  expect(html).toContain(">4<"); // lensesOnly count
  expect(html).toContain("Cross-cutting retry bug"); // holistic-only finding listed
  expect(html).toContain('href="#f-h-1"'); // …with a deep link to its card
  expect(html).toContain('class="chip chip-src">both'); // source chip on merged finding
});

test("meta.sharding surfaces on the Scope & limitations card without explicit limitations", () => {
  const html = page(
    baseReport({
      meta: {
        mode: "local", title: "t", base: "main", head: "feat", filesChanged: 1, additions: 1, deletions: 0,
        sharding: { sharded: true, threshold: 400, areas: ["Payments", "Auth"] },
      },
    })
  );
  expect(html).toContain("Scope &amp; limitations");
  expect(html).toContain("Sharded review");
  expect(html).toContain("Payments, Auth");
});

test("trackedIssue renders as a linked chip; hostile URLs are dropped", () => {
  const html = page(
    baseReport({
      findings: [
        mkFinding({ id: "a-1", trackedIssue: "https://github.com/o/r/issues/57" }),
        mkFinding({ id: "a-2", title: "Hostile", trackedIssue: "javascript:alert(1)" }),
      ],
    })
  );
  expect(html).toContain('class="chip chip-tracked"');
  expect(html).toContain('href="https://github.com/o/r/issues/57"');
  expect(html).not.toContain("javascript:alert(1)"); // safeUrl drops non-http schemes
  expect((html.match(/chip chip-tracked/g) || []).length).toBe(1); // only the valid one gets a chip
});

test("default path: none of the new sections/chips render when the fields are absent", () => {
  const html = page(baseReport({ findings: [mkFinding()] }));
  expect(html).not.toContain('id="more-findings"');
  expect(html).not.toContain('class="chip chip-tracked"');
  expect(html).not.toContain("Holistic comparison");
  expect(html).not.toContain('class="loc-list"');
  expect(html).not.toContain('class="chip chip-src"'); // (the CSS rule is always shipped)
  expect(html).not.toContain("Regraded");
  expect(html).not.toContain("Sharded review");
});

test("scorecardCard falls back to SCORE.na for a malformed status", () => {
  const html = page({
    meta: { mode: "local", title: "t", base: "main", head: "feat", filesChanged: 0, additions: 0, deletions: 0 },
    verdict: { decision: "comment", confidence: "high", summary: "ok" },
    triage: { groups: [], skipped: [] },
    scorecard: [{ area: "Mystery", status: "bogus", note: "unknown status" } as any],
    findings: [],
  } as any);
  expect(html).toContain('class="scorecard"');
  expect(html).toContain("Mystery"); // cell still renders
  expect(html).toContain("--sq:#8b8d98"); // na color from the SCORE.na fallback
  expect(html).not.toContain("undefined"); // never renders an undefined mark/color
});

// ---- system change (primitives lens) ----
const scReport = {
  meta: { title: "t" },
  verdict: { decision: "comment", confidence: "high", summary: "ok" },
  triage: { groups: [], skipped: [] },
  findings: [],
  systemChange: {
    mapPath: "docs/project/primitives.yaml",
    overall: "adds",
    mapUpdated: false,
    primitives: [
      {
        id: "prd",
        name: "PRD",
        area: "data",
        classification: "extends",
        files: ["convex/sharedPrds.ts"],
        invariantsTouched: ["Agents may set draft/in_review but never approve."],
        note: "Status validator consolidated.",
      },
    ],
    added: [{ name: "retry-queue", files: ["convex/retryQueue.ts"], note: "not in the map" }],
  },
};

test("validateReport accepts a well-formed systemChange and rejects a malformed one", () => {
  expect(validateReport(scReport)).toEqual([]);
  expect(validateReport({ systemChange: { primitives: "prd" } }).join(" ")).toContain("systemChange");
  expect(validateReport({ systemChange: [] }).join(" ")).toContain("systemChange");
});

test("systemChange card renders classification, invariants, and unmapped adds", () => {
  const html = page(scReport as any);
  expect(html).toContain("System change");
  expect(html).toContain("Extends");
  expect(html).toContain("never approve");
  expect(html).toContain("retry-queue");
  expect(html).toContain("map NOT updated");
});

test("systemChange card escapes hostile primitive content", () => {
  const hostile = JSON.parse(JSON.stringify(scReport));
  hostile.systemChange.primitives[0].name = `<img src=x onerror=alert(1)>`;
  hostile.systemChange.primitives[0].invariantsTouched = [`<script>alert(2)</script>`];
  const html = page(hostile as any);
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<script>alert(2)");
});

test("no systemChange section means no card", () => {
  const html = page({
    meta: { title: "t" },
    verdict: { decision: "approve", confidence: "high", summary: "ok" },
    triage: { groups: [], skipped: [] },
    findings: [],
  } as any);
  expect(html).not.toContain("System change");
});
