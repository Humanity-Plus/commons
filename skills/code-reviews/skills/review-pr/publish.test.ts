// Tests for the GitHub-publishing pipeline: diff anchoring, GFM degradation,
// and review-payload assembly. Run: bun test  (from this directory)
import { test, expect } from "bun:test";
import { parseDiffAnchors, toGfm, buildReview, resolveEvent, checkPrMismatch, gistGuardError, reviewFooter } from "./publish.ts";

// ---- --gist visibility guard (round 19: the private-source leak vector) ----
test("gistGuardError refuses non-public repos unless forced", () => {
  expect(gistGuardError("PRIVATE", false)).toContain("public-by-URL");
  expect(gistGuardError("INTERNAL", false)).toContain("INTERNAL");
  expect(gistGuardError("", false)).toContain("UNKNOWN"); // lookup failed → refuse, never assume
  expect(gistGuardError("PUBLIC", false)).toBeNull();
  expect(gistGuardError("private", false)).toContain("PRIVATE"); // case-insensitive
  expect(gistGuardError("PRIVATE", true)).toBeNull(); // explicit --force-gist overrides
});

// ---- cols degradation keeps paragraph breaks (round 17) ----
test("unwrapped block containers get paragraph breaks, spans stay inline", () => {
  const cols = toGfm(
    `<div class="cols"><div>**Producer** sets \`shape\` X</div><div>**Consumer** expects Y</div></div>`
  );
  expect(cols).toContain("sets");
  expect(cols).toMatch(/X\s*\n\s*\n/); // blank line after the first column
  expect(cols).not.toMatch(/X\*\*Consumer/); // no run-on concatenation
  expect(toGfm("a <span>b</span> c")).toBe("a b c"); // spans unwrap silently
});

// ---- stale-artifact backstop (round 14) ----
test("checkPrMismatch refuses another PR's findings, allows matches and unknowns", () => {
  expect(checkPrMismatch(154, "166")).toContain("describes PR #154");
  expect(checkPrMismatch(166, "166")).toBeNull();
  expect(checkPrMismatch(null, "166")).toBeNull(); // no meta → nothing to compare
  expect(checkPrMismatch(154, undefined)).toBeNull(); // pr came FROM meta → consistent
});

// ---- nearest-anchor for blockers on unchanged lines (round 14) ----
const nearMeta = { repo: "acme/checkout", prNumber: 482, headSha: "9f3c1ab" };
const mkNearFinding = (over: Record<string, unknown>) => ({
  id: "x-1",
  lens: "first-five",
  severity: "high",
  category: "Error Handling",
  file: "src/pay/charge.ts",
  line: 16, // NOT in the diff; nearest changed line is 13 (3 away)
  title: "Unguarded retry",
  evidence: "e",
  suggestion: "s",
  featureArea: "Payments",
  ...over,
});
const nearReview = (finding: Record<string, unknown>) =>
  buildReview(
    {
      meta: nearMeta,
      verdict: { decision: "comment", confidence: "high", summary: "ok" },
      findings: [finding],
    } as any,
    parseDiffAnchors(DIFF),
    { event: "COMMENT" }
  );

test("a high finding on an unchanged line anchors to the nearest changed line with a note", () => {
  const payload = nearReview(mkNearFinding({}));
  expect(payload.comments.length).toBe(1);
  expect(payload.comments[0].line).toBe(13); // nearest anchor, not the finding's own line
  expect(payload.comments[0].body).toContain("Anchored to the nearest changed line");
  expect(payload.comments[0].body).toContain("charge.ts:16"); // real location stated
});

test("nearest-anchor applies only to blockers and only within the distance cap", () => {
  const medium = nearReview(mkNearFinding({ severity: "medium" }));
  expect(medium.comments.length).toBe(0); // medium folds to the body as before
  const far = nearReview(mkNearFinding({ line: 200 })); // 187 lines from nearest anchor
  expect(far.comments.length).toBe(0); // beyond the cap → body fold
  const exact = nearReview(mkNearFinding({ line: 11 })); // actually in the diff
  expect(exact.comments[0].line).toBe(11);
  expect(exact.comments[0].body).not.toContain("Anchored to the nearest"); // no note on exact anchors
});

// ---- self-review downgrade truth table (the round-6 422 bug) ----
test("resolveEvent downgrades REQUEST_CHANGES to COMMENT on your own PR", () => {
  expect(resolveEvent("request-changes", "paal", "paal")).toEqual({
    event: "COMMENT",
    downgraded: true,
  });
  expect(resolveEvent("approve", "paal", "paal")).toEqual({ event: "COMMENT", downgraded: true });
});

test("resolveEvent leaves the event alone for another author", () => {
  expect(resolveEvent("request-changes", "paal", "someone-else")).toEqual({
    event: "REQUEST_CHANGES",
    downgraded: false,
  });
});

test("resolveEvent cannot downgrade when login or author is unknown (the warn path)", () => {
  // Missing author must NOT silently match — main warns and/or retries on 422 instead.
  expect(resolveEvent("request-changes", "paal", "")).toEqual({
    event: "REQUEST_CHANGES",
    downgraded: false,
  });
  expect(resolveEvent("request-changes", "", "paal")).toEqual({
    event: "REQUEST_CHANGES",
    downgraded: false,
  });
});

test("resolveEvent maps comment and unknown decisions to COMMENT, never downgraded", () => {
  expect(resolveEvent("comment", "paal", "paal")).toEqual({ event: "COMMENT", downgraded: false });
  expect(resolveEvent("bogus", "paal", "paal")).toEqual({ event: "COMMENT", downgraded: false });
});

// ---- tracked findings (the round-12 double-routing fix) ----
test("a tracked finding is never posted inline and renders as a one-liner in the body", () => {
  const finding = {
    id: "conventions-9",
    lens: "conventions",
    severity: "low" as const,
    category: "Readability",
    file: "src/pay/charge.ts",
    line: 11, // anchorable in DIFF — would be inline without trackedIssue
    title: "Oversized function",
    evidence: "Long evidence prose that must NOT be duplicated into the review.",
    suggestion: "Split it.",
    featureArea: "Payments",
    trackedIssue: "https://github.com/acme/checkout/issues/57",
  };
  const payload = buildReview(
    {
      meta: { repo: "acme/checkout", prNumber: 482, headSha: "9f3c1ab" },
      verdict: { decision: "comment", confidence: "high", summary: "ok" },
      findings: [finding],
    } as any,
    parseDiffAnchors(DIFF),
    { event: "COMMENT" }
  );
  expect(payload.comments.length).toBe(0); // not inline despite valid anchor
  expect(payload.body).toContain("tracked as [#57](https://github.com/acme/checkout/issues/57)");
  expect(payload.body).not.toContain("must NOT be duplicated"); // prose not double-routed
  // and without trackedIssue the same finding IS inline
  const untracked = buildReview(
    {
      meta: { repo: "acme/checkout", prNumber: 482, headSha: "9f3c1ab" },
      verdict: { decision: "comment", confidence: "high", summary: "ok" },
      findings: [{ ...finding, trackedIssue: undefined }],
    } as any,
    parseDiffAnchors(DIFF),
    { event: "COMMENT" }
  );
  expect(untracked.comments.length).toBe(1);
});

const DIFF = `diff --git a/src/pay/charge.ts b/src/pay/charge.ts
index 111..222 100644
--- a/src/pay/charge.ts
+++ b/src/pay/charge.ts
@@ -10,4 +10,5 @@ export function charge() {
 const amount = 1;
-const old = stripe.captureIntent(id);
+const fresh = stripe.capturePaymentIntent(id);
+log(fresh);
 return fresh;
diff --git a/README.md b/README.md
deleted file mode 100644
--- a/README.md
+++ /dev/null
@@ -1,2 +0,0 @@
-# gone
-bye
`;

test("parseDiffAnchors: added + context lines on the new side are commentable", () => {
  const anchors = parseDiffAnchors(DIFF);
  const lines = anchors.get("src/pay/charge.ts")!;
  // hunk starts at new line 10: context(10), del(skipped), add(11), add(12), context(13)
  expect([...lines].sort((a, b) => a - b)).toEqual([10, 11, 12, 13]);
  // deleted file has no new side
  expect(anchors.has("README.md")).toBe(false);
});

test("toGfm: SVG dropped, layout divs unwrapped, fenced code untouched", () => {
  const src = [
    `<div class="callout warn">`,
    `<div class="callout-title">Careful</div>`,
    ``,
    `A **bold** claim with <svg viewBox="0 0 10 10"><rect/></svg> inside.`,
    `</div>`,
    ``,
    "```diff",
    `-<div>keep me literally</div>`,
    "```",
  ].join("\n");
  const out = toGfm(src);
  expect(out).not.toContain("<svg");
  expect(out).toContain("diagram omitted");
  const outsideFence = out.split("```")[0];
  expect(outsideFence).not.toMatch(/<\/?div/); // outside fences: divs unwrapped…
  expect(out).toContain("-<div>keep me literally</div>"); // …inside fences: preserved
  expect(out).toContain("A **bold** claim");
});

test("toGfm: backticked path:line becomes a blob permalink", () => {
  const meta = { repo: "acme/app", headSha: "abc1234def" };
  const out = toGfm("See `src/pay/charge.ts:42` and plain `amount`.", meta);
  expect(out).toContain(
    "[`src/pay/charge.ts:42`](https://github.com/acme/app/blob/abc1234def/src/pay/charge.ts#L42)"
  );
  expect(out).toContain("`amount`"); // non-path inline code untouched
});

const REPORT = {
  meta: { repo: "acme/app", prNumber: 7, headSha: "abc1234", author: "dev1" },
  verdict: { decision: "request-changes", confidence: "high", summary: "One real bug." },
  findings: [
    {
      id: "first-five-1",
      lens: "first-five",
      severity: "high" as const,
      category: "External Calls",
      file: "src/pay/charge.ts",
      line: 11,
      title: "Wrong Stripe method",
      evidence: "It calls the wrong thing.",
      suggestion: "Rename it.",
      featureArea: "Payments",
    },
    {
      id: "preflight-1",
      lens: "preflight",
      severity: "medium" as const,
      category: "Config",
      file: "",
      line: 0,
      title: "New env var needed",
      evidence: "",
      suggestion: "Set `STRIPE_KEY` before deploy.",
      featureArea: "Payments",
    },
    {
      id: "first-five-2",
      lens: "first-five",
      severity: "low" as const,
      category: "Errors",
      file: "src/pay/charge.ts",
      line: 999, // not in the diff
      title: "Out-of-diff finding",
      evidence: "",
      suggestion: "",
      featureArea: "Payments",
    },
  ],
};

test("buildReview: anchored → inline comment; unanchored + out-of-diff → body", () => {
  const anchors = parseDiffAnchors(DIFF);
  const p = buildReview(REPORT, anchors, { event: "REQUEST_CHANGES" });
  expect(p.event).toBe("REQUEST_CHANGES");
  expect(p.commit_id).toBe("abc1234");
  expect(p.comments).toHaveLength(1);
  expect(p.comments[0]).toMatchObject({ path: "src/pay/charge.ts", line: 11, side: "RIGHT" });
  expect(p.comments[0].body).toContain("Wrong Stripe method");
  expect(p.comments[0].body).toContain("first-five-1");
  // body carries the verdict, the preflight item, and the out-of-diff finding
  expect(p.body).toContain("Request Changes");
  expect(p.body).toContain("New env var needed");
  expect(p.body).toContain("Out-of-diff finding");
  expect(p.body).not.toContain("Wrong Stripe method"); // inline ones aren't duplicated
});

test("buildReview: --body-only puts everything in the body; report link + downgrade note", () => {
  const anchors = parseDiffAnchors(DIFF);
  const p = buildReview(REPORT, anchors, {
    event: "COMMENT",
    bodyOnly: true,
    downgraded: true,
    reportUrl: "https://example.com/r.html",
  });
  expect(p.comments).toHaveLength(0);
  expect(p.body).toContain("Wrong Stripe method");
  expect(p.body).toContain("https://example.com/r.html");
  expect(p.body).toContain("your own PR");
});

test("reviewFooter: full identity → attribution marker; anything missing → plain stamp", () => {
  const meta = { generatedAt: "2026-08-14", model: "Claude Fable 5", harness: "Claude Code" };
  expect(reviewFooter(meta, "octo")).toBe(
    "<sub>🤖 Written on behalf of @octo by Claude Fable 5 via Claude Code · review-pr · 2026-08-14</sub>"
  );
  // no login, and half-filled identity, both fall back — never a variant marker
  expect(reviewFooter(meta)).toBe("<sub>Generated by review-pr · 2026-08-14</sub>");
  expect(reviewFooter({ ...meta, harness: undefined }, "octo")).toBe(
    "<sub>Generated by review-pr · 2026-08-14</sub>"
  );
  expect(reviewFooter({}, "octo")).toBe("<sub>Generated by review-pr</sub>");
});

test("buildReview stamps the attributed footer into the review body", () => {
  const report = {
    ...REPORT,
    meta: { ...REPORT.meta, model: "Claude Fable 5", harness: "Claude Code" },
  };
  const p = buildReview(report, parseDiffAnchors(DIFF), { event: "COMMENT", login: "octo" });
  expect(p.body).toContain(
    "<sub>🤖 Written on behalf of @octo by Claude Fable 5 via Claude Code · review-pr</sub>"
  );
});

test("buildReview: min-severity gates inline comments, not the body", () => {
  const anchors = parseDiffAnchors(DIFF);
  const report = {
    ...REPORT,
    findings: REPORT.findings.map((f) =>
      f.id === "first-five-2" ? { ...f, line: 12 } : f // make the low finding anchorable
    ),
  };
  const all = buildReview(report, anchors, { event: "COMMENT" });
  expect(all.comments).toHaveLength(2);
  const gated = buildReview(report, anchors, { event: "COMMENT", minSeverity: "medium" });
  expect(gated.comments).toHaveLength(1); // low finding pushed to the body
  expect(gated.body).toContain("Out-of-diff finding");
});
