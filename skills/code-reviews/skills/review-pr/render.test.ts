// Safety regression tests for the rich-content sanitizer.
// Run: bun test  (from this directory)
import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sanitizeHtml, renderInline, renderRich, page, validateReport, normalizeReport } from "./render.ts";

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

test("severities are normalized where the spelling is unambiguous and refused where it is not", () => {
  const sev = (severity: unknown, id: unknown = "a-1") => ({ findings: [{ id, severity }] });
  expect(normalizeReport(sev(" Nit ")).findings[0].severity).toBe("nitpick"); // the drift the field reported
  expect(normalizeReport(sev("nitpicks")).findings[0].severity).toBe("nitpick");
  expect(normalizeReport(sev("HIGH")).findings[0].severity).toBe("high");
  expect(validateReport(sev("blocker")).join(" ")).toContain('finding a-1: severity "blocker" is not one of critical | high | medium | low | nitpick');
  expect(validateReport(sev("blocker", null)).join(" ")).toContain("finding (no id): severity");
  expect(validateReport(sev(undefined)).join(" ")).toContain("finding a-1"); // a missing severity no longer renders as medium
  expect(validateReport({ findings: "nope" }).join(" ")).toContain("findings must be an array"); // the older check still wins
  // shapes that are not findings are left for validation to name, never thrown on
  expect(normalizeReport({ findings: "nope" } as any).findings).toBe("nope");
  expect(() => normalizeReport({ findings: [null, "x", { id: "b-1", severity: "LOW" }] } as any)).not.toThrow();
  expect(validateReport({ findings: [null] }).join(" ")).toContain("finding (no id)");
});

test("render.ts itself normalizes before it validates and renders", () => {
  const dir = mkdtempSync(join(tmpdir(), "review-pr-render-"));
  const report = (severity: string) =>
    JSON.stringify(baseReport({ findings: [mkFinding({ severity, title: "Spelled loosely" })] }));
  const render = (severity: string) => {
    writeFileSync(join(dir, "f.json"), report(severity));
    const r = Bun.spawnSync(["bun", "run", join(import.meta.dir, "render.ts"), join(dir, "f.json"), join(dir, "out.html")]);
    return { code: r.exitCode, err: r.stderr.toString() };
  };
  expect(render(" Nit ").code).toBe(0);
  expect(readFileSync(join(dir, "out.html"), "utf8")).toMatch(/⚪ Nitpick<\/span>/); // rendered as a nitpick, not as the medium fallback
  const refused = render("blocker");
  expect(refused.code).toBe(1);
  expect(refused.err).toContain('severity "blocker" is not one of');
  rmSync(dir, { recursive: true, force: true });
});

test("an off-head review shows both commits and links no line", () => {
  const meta = { mode: "pr", title: "t", repo: "acme/app", headSha: "aaaaaaa1111", filesChanged: 1, additions: 1, deletions: 0 };
  const onHead = page(baseReport({ meta, findings: [mkFinding()] }));
  expect(onHead).toContain('<a class="ref" href="https://github.com/acme/app/blob/aaaaaaa1111/src/a.ts#L10"');
  expect(onHead).not.toContain("reviewed as merged at");
  const off = page(baseReport({ meta: { ...meta, reviewedSha: "bbbbbbb2222" }, findings: [mkFinding()] }));
  expect(off).toContain('<span class="ref">src/a.ts:10</span>'); // the reference stays, the link goes
  expect(off).not.toContain("blob/aaaaaaa1111/src/a.ts");
  expect(off).toContain("reviewed as merged at <b>bbbbbbb</b>");
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

test("finding text can't close the report's containers and add markup outside its card", () => {
  const out = renderRich(
    'Looks fine.</div></div></article></section><div class="callout ok"><b>Verdict: Approve</b></div><section><article><div><div>'
  );
  // Stray closers are dropped, so the callout stays inside the paragraph that opened first.
  expect(out.startsWith('<p>Looks fine.<div class="callout ok">')).toBe(true);
  // Tags the input left open are closed before the paragraph ends.
  expect(out.endsWith("</div></div></article></section></p>")).toBe(true);
});

test("closing an outer tag closes the tags still open inside it", () => {
  expect(sanitizeHtml("<div><b>bold</div>after")).toBe("<div><b>bold</b></div>after");
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

test("class findings render the chip, the evidence line, and the Classes card; blank marks and hostile evidence do not", () => {
  const html = page(
    baseReport({
      findings: [
        mkFinding({ id: "c-1", title: "Inline status enum", classEvidence: "3 sites in this diff <script>bad()</script>" }),
        mkFinding({ id: "c-2", title: "Count drifted again", classEvidence: "also findings-pr41.json intent-5" }),
        mkFinding({ id: "c-3", title: "Plain finding" }),
        mkFinding({ id: "c-4", title: "Blank mark", classEvidence: "   " }), // whitespace is not a mark
      ],
    })
  );
  expect((html.match(/class="chip chip-class"/g) || []).length).toBe(2); // the two marked ones, not the blank
  expect((html.match(/class="finding-class"/g) || []).length).toBe(2); // the evidence line per marked card
  expect(html).toContain("3 sites in this diff");
  expect(html).not.toContain("<script>bad()"); // evidence goes through the sanitizer
  const start = html.indexOf('class="card cls-card"');
  const card = html.slice(start, html.indexOf("</section>", start));
  expect(card).toContain("2 to fix as a class"); // the Classes card counts the marked findings…
  expect(card).toContain('href="#f-c-1"'); // …links each…
  expect(card).toContain('href="#f-c-2"');
  expect(card.indexOf("Inline status enum")).toBeLessThan(card.indexOf("Count drifted again")); // …in finding order…
  expect(card).toContain('<span class="cls-why">also findings-pr41.json intent-5</span>'); // …with its evidence
  expect(card).not.toContain("Plain finding"); // unmarked findings stay out of it
  expect(card).not.toContain("Blank mark"); // and so does the blank mark
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

test("preflight verifiable renders as an escaped verify line, absent otherwise", () => {
  const mk = (over: Record<string, unknown> = {}) => ({
    id: "preflight-1", lens: "preflight", severity: "medium", category: "Operational",
    confidence: "medium", file: "", line: 0, title: "Check the alert rule",
    evidence: "e", suggestion: "s", featureArea: "Ops", ...over,
  });
  const html = page(
    baseReport({ findings: [mk({ verifiable: 'gh api /alerts | grep "<session>"' })] })
  );
  expect(html).toContain('class="pf-verify"');
  expect(html).toContain("&lt;session&gt;"); // escaped, not live markup
  const without = page(baseReport({ findings: [mk()] }));
  expect(without).not.toContain('class="pf-verify"');
});

test("verifiable on a non-preflight finding renders a verify line on its card", () => {
  const html = page(
    baseReport({
      findings: [mkFinding({ verifiable: "npx convex run debug:getTableCounts --prod" })],
    })
  );
  expect(html).toContain('class="pf-verify"');
  expect(html).toContain("getTableCounts");
  // a command with a long path must be able to wrap: as a flex item it otherwise widens the page
  expect(html).toMatch(/\.pf-verify code\{[^}]*min-width:0;overflow-wrap:anywhere\}/);
  // and at phone width so must a file reference outside .md (field: a 50-character path made a 375px page 520px wide)
  const narrow = html.slice(html.lastIndexOf("@media(max-width:720px){"));
  expect(narrow).toContain("a.ref{white-space:normal;overflow-wrap:anywhere}");
  expect(narrow).toContain(".test-body,.finding-ref{min-width:0}");
  const without = page(baseReport({ findings: [mkFinding()] }));
  expect(without).not.toContain('class="pf-verify"');
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
  expect(html).not.toContain('class="chip chip-class"');
  expect(html).not.toContain("cls-card");
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

test("systemChange card renders summary, duplication check, mapped vs unmapped adds, and invariants", () => {
  const html = page(scReport as any);
  expect(html).toContain("System change");
  expect(html).toContain("Extends");
  expect(html).toContain("never approve");
  expect(html).toContain("retry-queue");
  expect(html).toContain("map NOT updated");
  expect(html).toContain("No duplicate primitives");

  // A newly added primitive that IS mapped in the same PR must not render as an unmapped warning,
  // and `overall` must never downgrade to "Composes" when `added` is non-empty.
  const mapped = {
    meta: { title: "t" },
    verdict: { decision: "comment", confidence: "high", summary: "ok" },
    triage: { groups: [], skipped: [] },
    findings: [],
    systemChange: {
      mapPath: "docs/primitives.yaml",
      overall: "composes",
      mapUpdated: true,
      summary: "Adds carrier rate lookup during checkout using existing shipping options.",
      duplicationCheck: {
        status: "duplicated",
        summary: "Re-declares shipping tier values inline.",
        duplicates: ["<script>x</script>SHIPPING_TIER"],
      },
      primitives: [
        {
          id: "shipping-options",
          name: "Shipping options",
          classification: "composes",
          invariantsViolated: ["Do not re-declare persisted values."],
          note: "Reuses existing options.",
        },
      ],
      added: [{ name: "Rate lookup", mapped: true, files: ["a.ts", "b.ts", "c.ts"], note: "Mapped in this PR." }],
    },
  };
  const mappedHtml = page(mapped as any);
  expect(mappedHtml).toContain("Adds carrier rate lookup during checkout");
  expect(mappedHtml).toContain("Duplicates an existing primitive");
  expect(mappedHtml).toContain("SHIPPING_TIER");
  expect(mappedHtml).not.toContain("<script>x</script>");
  expect(mappedHtml).toContain("New primitives (mapped in this PR)");
  expect(mappedHtml).not.toContain("New primitives not in the map");
  expect(mappedHtml).toContain("sc-inv-warn");
  expect(mappedHtml).toContain("3 files"); // collapsed file list when > 2 files
  // Header pill reflects Adds (not Composes) because `added` is non-empty.
  const scHead = mappedHtml.slice(mappedHtml.indexOf("<h2>System change"), mappedHtml.indexOf("</h2>", mappedHtml.indexOf("<h2>System change")));
  expect(scHead).toContain(">Adds<");
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

// ---- blast-radius card (the safety fact, its evidence rung, cleared risks) ----
const brReport = {
  meta: { title: "t", repo: "acme/checkout", headSha: "9f3c1ab" },
  verdict: { decision: "comment", confidence: "high", summary: "ok" },
  triage: { groups: [], skipped: [] },
  blastRadius: {
    summary: "Capture retries network errors up to three times.",
    safetyFact: {
      claim: "A repeated capture of an already-captured intent is a no-op at `stripe@14.2.0`.",
      evidence: "skeptic",
      status: "unproven",
      proof: "`node_modules/stripe/lib/resources/PaymentIntents.js:40` reuses the idempotency key.",
      probe: "bun test src/pay/charge.test.ts -t 'capture retry'",
    },
    cleared: [{ what: "Other readers of `charges.attempts`", how: "grep: only `reports/daily.ts`, which sums it." }],
    preMerge: "Run the capture tests with the mock failing the first call.",
  },
  findings: [
    {
      id: "blast-radius-1",
      lens: "blast-radius",
      severity: "high",
      category: "Production path",
      likelihood: "high",
      file: "src/pay/charge.ts",
      line: 31,
      title: "The retry loop sits behind a flag production has off",
      evidence: "e",
      suggestion: "s",
      featureArea: "Payments",
    },
  ],
};

test("validateReport accepts blastRadius with or without safetyFact, and rejects malformed ones", () => {
  expect(validateReport(brReport)).toEqual([]);
  expect(validateReport({ blastRadius: { impact: "contained", summary: "Isolated to one screen." } })).toEqual([]);
  expect(validateReport({ blastRadius: [] }).join(" ")).toContain("blastRadius");
  expect(validateReport({ blastRadius: {} }).join(" ")).toContain("blastRadius");
  expect(validateReport({ blastRadius: { safetyFact: "x" } }).join(" ")).toContain("blastRadius");
  expect(validateReport({ blastRadius: { safetyFact: { evidence: "skeptic" } } }).join(" ")).toContain("claim");
});

test("blast-radius card leads with collateral impact, collapses cleared checks and optional probe, and links findings", () => {
  const html = page(brReport as any);
  expect(html).toContain("Blast radius");
  expect(html).toContain("Breaking reach"); // derived from high blast-radius finding
  expect(html).toContain("Unproven");
  expect(html).toContain("traced"); // rung 3 label inside collapsed verification assumption
  expect(html).toContain("capture retry"); // the probe, escaped
  expect(html).toContain("1 unintended effect · 1 checked &amp; unaffected");
  expect(html).toContain('href="#f-blast-radius-1"'); // open risk links to its finding card
  expect(html).toContain("likelihood high"); // both in the card and as a chip
  expect(html).toContain('class="chip chip-like"');
  expect(html).toContain("Before merge");
  expect(html).toContain("which sums it");
  expect(html).toContain("Capture retries network errors");

  // Contained PR without a safetyFact renders cleanly with no runtime lecture.
  const contained = page(
    baseReport({
      blastRadius: {
        impact: "contained",
        summary: "Adds a read-only rate estimate button on the checkout form.",
        sideEffects: [],
        cleared: [{ what: "Existing order saves", how: "Unchanged save path." }],
      },
    })
  );
  expect(contained).toContain("Contained");
  expect(contained).toContain("No unintended effects on existing system behavior");
  expect(contained).not.toContain("Verification assumption");

  // Explicit sideEffects render with area, effect, and finding deep-link; hostile markup is escaped.
  const withSideEffect = page(
    baseReport({
      blastRadius: {
        impact: "side-effects",
        summary: "Excludes local cache folders from device backups.",
        sideEffects: [
          {
            area: "Device restore",
            effect: "Restoring a phone drops <script>bad()</script>unsynced drafts.",
            severity: "medium",
            findingId: "blast-radius-1",
          },
        ],
      },
    })
  );
  expect(withSideEffect).toContain("Side effects");
  expect(withSideEffect).toContain("Device restore");
  expect(withSideEffect).toContain('href="#f-blast-radius-1"');
  expect(withSideEffect).not.toContain("<script>bad()");
});

test("blast-radius status pill follows status; contradicted assumption surfaces loudly and unknown evidence falls back to lowest rung", () => {
  const contradicted = JSON.parse(JSON.stringify(brReport));
  contradicted.blastRadius.safetyFact.status = "contradicted";
  contradicted.blastRadius.safetyFact.evidence = "guesswork";
  const html = page(contradicted as any);
  expect(html).toContain("Breaking reach");
  expect(html).toContain("Contradicted");
  expect(html).toContain("asserted");
});

test("triage tolerates string files, scope descriptions, and object skipped entries without rendering [object Object]", () => {
  const html = page(
    baseReport({
      triage: {
        groups: [
          {
            name: "Shipping rates",
            risk: "high",
            scope: "Calls carrier API from a backend action.",
            files: ["packages/backend/rates.ts"],
          },
        ],
        skipped: [{ file: "convex/_generated/api.d.ts", reason: "generated" }],
      },
    })
  );
  expect(html).not.toContain("[object Object]");
  expect(html).toContain("packages/backend/rates.ts");
  expect(html).toContain("Calls carrier API from a backend action.");
  expect(html).toContain("convex/_generated/api.d.ts");
  expect(html).toContain("generated");
});

test("summary supports in-page #f- anchor links, empty optional sections are omitted, and preflight hides blank confidence", () => {
  const html = page(
    baseReport({
      verdict: {
        decision: "comment",
        confidence: "medium",
        summary: "See [the timeout bug](#f-first-five-1) before merging.",
      },
      findings: [
        mkFinding({ id: "first-five-1" }),
        {
          id: "preflight-1",
          lens: "preflight",
          severity: "low",
          category: "Operational",
          file: "",
          line: 0,
          title: "Run pod install",
          evidence: "e",
          suggestion: "s",
          featureArea: "Native",
        },
      ],
    })
  );
  expect(html).toContain('<a href="#f-first-five-1">the timeout bug</a>');
  expect(html).not.toContain('id="deps"'); // empty Dependencies card omitted
  expect(html).not.toContain('id="tests"'); // empty Test gaps card omitted
  expect(html).not.toContain('class="pf-conf'); // blank confidence does not render an empty pill
});

test("blast-radius card escapes hostile content", () => {
  const hostile = JSON.parse(JSON.stringify(brReport));
  hostile.blastRadius.summary = `<img src=x onerror=alert(1)>`;
  hostile.blastRadius.safetyFact.claim = `<script>alert(2)</script>claim`;
  hostile.blastRadius.safetyFact.probe = `<b onclick=steal()>x</b>`;
  hostile.blastRadius.cleared[0].how = `<iframe src=https://e></iframe>`;
  hostile.findings[0].likelihood = `<svg onload=alert(3)>`;
  const html = page(hostile as any);
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<script>alert(2)");
  expect(html).not.toContain("<b onclick"); // escaped to text, never a tag
  expect(html).not.toContain("<iframe");
  expect(html).not.toContain("<svg onload");
  expect(html).toContain("claim");
});

test("no blastRadius section means no card and no likelihood chip", () => {
  const html = page(baseReport({ findings: [mkFinding()] }));
  expect(html).not.toContain("Blast radius");
  expect(html).not.toContain('class="chip chip-like"');
});

// ---- interrogate branch: per-seat ledger card and the run that proves a finding ----
const igFinding = {
  id: "interrogate-b-1",
  lens: "interrogate",
  severity: "high",
  category: "State and time",
  source: "interrogate",
  file: "src/pay/charge.ts",
  line: 44,
  title: "A second capture after a timeout charges the order twice",
  evidence: "e",
  suggestion: "s",
  featureArea: "Payments",
  repro: "bun test src/pay/charge.test.ts -t 'capture retry charges once'",
  patch: "diff --git a/src/pay/charge.test.ts b/src/pay/charge.test.ts\n+test('capture retry charges once', …)",
  observed: "Expected length: 1\nReceived length: 2",
  expected: "one charge recorded across the retry",
};
const igReport = {
  meta: {
    title: "t",
    interrogate: {
      adversaries: [
        { seat: "A", runner: "agent", brief: "Inputs and boundaries", findings: 1, kept: 0, dropped: 1, droppedWhy: "rerun passed" },
        { seat: "B", runner: "codex exec", brief: "State and time", findings: 2, kept: 1, dropped: 1, droppedWhy: "style, not a run" },
      ],
      interrogateOnly: 1,
      both: 0,
    },
  },
  verdict: { decision: "request-changes", confidence: "high", summary: "ok" },
  triage: { groups: [], skipped: [] },
  findings: [igFinding],
};

test("interrogation card renders the per-seat ledger, runner families, and interrogate-only links", () => {
  const html = page(igReport as any);
  expect(html).toContain("Interrogation");
  expect(html).toContain("2 seats · 2 runner families");
  expect(html).toContain("codex exec");
  expect(html).toContain("State and time");
  expect(html).toContain("rerun passed");
  expect(html).toContain('href="#f-interrogate-b-1"');
  expect(html).toContain('class="chip chip-src">interrogate');
});

test("an interrogate finding's card carries repro, observed, expected, and the patch", () => {
  const html = page(igReport as any);
  expect(html).toContain("capture retry charges once");
  expect(html).toContain("Received length: 2");
  expect(html).toContain("one charge recorded across the retry");
  expect(html).toContain("repro patch");
});

test("interrogation content is escaped; a seat list without runners counts one family of none", () => {
  const hostile = JSON.parse(JSON.stringify(igReport));
  hostile.findings[0].repro = `<script>alert(1)</script>`;
  hostile.findings[0].observed = `<img src=x onerror=alert(2)>`;
  hostile.meta.interrogate.adversaries[0].droppedWhy = `<b onclick=x>why</b>`;
  const html = page(hostile as any);
  expect(html).not.toContain("<script>alert(1)");
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain("<b onclick");
  expect(html).toContain("why");
  const bare = JSON.parse(JSON.stringify(igReport));
  bare.meta.interrogate = { adversaries: [] };
  expect(page(bare as any)).toContain("No adversary seats recorded");
});

test("default path: no interrogation card and no repro block when the fields are absent", () => {
  const html = page(baseReport({ findings: [mkFinding()] }));
  expect(html).not.toContain("Interrogation");
  expect(html).not.toContain('class="repro"');
});

// ---- panel (the panel arg: a generalist seat on another vendor's runner) ----
const panelReport = (panel: unknown, findings: unknown[], meta: Record<string, unknown> = {}) =>
  baseReport({ meta: { title: "t", ...meta, panel }, findings });
const panelCardOf = (html: string) => {
  const start = html.indexOf("<h2>Panel ");
  return html.slice(start, html.indexOf("</section>", start));
};

test("panel card renders the ledger, distinct counts, a failed seat, and only the panel-only findings; all escaped", () => {
  const html = page(
    panelReport(
      {
        seats: [
          { runner: "agy", model: "<b>neon</b>", findings: 7, kept: 5, dropped: 2, droppedWhy: "<i>refuted</i> by the source" },
          { runner: "<u>codex</u>", findings: 0, kept: 0, dropped: 0, failed: "not <signed> in" },
        ],
        panelOnly: 3,
        both: 5,
      },
      [
        mkFinding({ id: "panel-agy-1", lens: "panel", source: "panel", title: "Only the other <em>family</em> saw this" }),
        mkFinding({ id: "first-five-1", source: "both", title: "Both saw this" }),
        mkFinding({ id: "first-five-2", source: "lenses", title: "Lenses only" }),
      ]
    )
  );
  const card = panelCardOf(html);
  expect(card).toContain("1 of 2 seats ran, on another model family");
  expect(card).toMatch(/<div class="holi-num">3<\/div><div class="holi-lbl">panel only<\/div>/); // meta's totals, not the list length
  expect(card).toMatch(/<div class="holi-num">5<\/div><div class="holi-lbl">both<\/div>/);
  expect(card).toContain('<td class="irg-seat">agy</td><td>&lt;b&gt;neon&lt;/b&gt;</td>');
  expect(card).toContain("&lt;i&gt;refuted&lt;/i&gt; by the source");
  expect(card).toContain('<td class="irg-seat">&lt;u&gt;codex&lt;/u&gt;</td>');
  expect(card).toContain('<td colspan="3" class="irg-why">did not run: not &lt;signed&gt; in</td>'); // a failed seat shows why, not zeros
  expect(card).toContain('href="#f-panel-agy-1"');
  expect(card).toContain("Only the other &lt;em&gt;family&lt;/em&gt; saw this");
  expect(card).not.toMatch(/<(b|i|u|em)>/); // nothing from a seat reaches the page as markup
  expect(card).not.toContain("Both saw this"); // merged findings are not panel-only
  expect(card).not.toContain("Lenses only");
  expect(html).toContain('class="chip chip-src">panel'); // origin chip on the finding card
});

test("panel card falls back when totals are omitted, and handles no seats", () => {
  const derived = panelCardOf(
    page(panelReport({ seats: [{ runner: "agy", findings: 3, kept: 3, dropped: 0 }] }, [
      mkFinding({ id: "panel-agy-1", source: "panel" }),
      mkFinding({ id: "panel-agy-2", source: "panel" }),
      mkFinding({ id: "first-five-1", source: "both" }),
    ]))
  );
  expect(derived).toMatch(/<div class="holi-num">2<\/div><div class="holi-lbl">panel only<\/div>/); // counted from the findings
  expect(derived).toMatch(/<div class="holi-num">0<\/div><div class="holi-lbl">both<\/div>/);
  expect(derived).toContain("1 of 1 seat ran");
  for (const panel of [{ seats: [] }, { panelOnly: 0 }]) {
    const empty = panelCardOf(page(panelReport(panel, [mkFinding({ source: "both" })])));
    expect(empty).toContain("0 of 0 seats ran");
    expect(empty).toContain("No panel seats recorded.");
    expect(empty).toContain("No panel-only findings");
  }
  expect(page(baseReport({ findings: [mkFinding()] }))).not.toContain("<h2>Panel ");
});

test("holistic beside panel: a finding the host generalist also found is holistic-only, never panel-only", () => {
  const html = page(
    panelReport(
      { seats: [{ runner: "agy", findings: 3, kept: 3, dropped: 0 }], panelOnly: 1, both: 2 },
      [
        mkFinding({ id: "holistic-1", lens: "holistic", source: "holistic", title: "Generalist and panel, no lens" }),
        mkFinding({ id: "panel-agy-2", lens: "panel", source: "panel", title: "Family only" }),
        mkFinding({ id: "first-five-1", source: "both", title: "A lens and the panel" }),
      ],
      { holistic: { lensesOnly: 0, holisticOnly: 1, both: 0 } }
    )
  );
  const card = panelCardOf(html);
  expect(card).toContain("Family only");
  expect(card).not.toContain("Generalist and panel, no lens");
  const hStart = html.indexOf("<h2>Holistic comparison");
  const holistic = html.slice(hStart, html.indexOf("</section>", hStart));
  expect(holistic).toContain("Generalist and panel, no lens"); // a decomposition gap, shown where that is measured
  expect(holistic).not.toContain("Family only");
});
