#!/usr/bin/env bun
/**
 * publish.ts — post a review-pr findings.json to GitHub as a real PR review.
 *
 * Usage:
 *   bun run publish.ts <findings.json> [options]
 *   Run from the REPO ROOT of the repo under review: the findings path and gh's
 *   repo context both resolve relative to cwd.
 *
 * Options:
 *   --pr <n>             PR number   (default: meta.prNumber from findings.json)
 *   --repo <owner/name>  Repo slug   (default: meta.repo from findings.json)
 *   --report-url <url>   Link the full HTML report in the review body
 *   --gist               Host report.html (next to findings.json) as a secret gist
 *                        and link it via htmlpreview.github.io. NOTE: secret gists
 *                        are public-by-URL — so this HARD-REFUSES when the repo's
 *                        visibility is not PUBLIC (the one place this pipeline
 *                        could leak private source to a public URL). Override
 *                        only with an explicit --force-gist.
 *   --force-gist         Host the gist even though the repo is private/internal.
 *                        You are choosing to put review content (code excerpts,
 *                        file paths) on a public-by-URL host — be sure.
 *   --report <path>      Report file for --gist (default: <findings dir>/report.html)
 *   --min-severity <s>   Only findings at/above this severity become INLINE comments
 *                        (critical|high|medium|low|nitpick, default nitpick = all);
 *                        the rest are summarized in the review body instead.
 *   --body-only          No inline comments; everything goes in one review body.
 *   --dry-run            Print the review payload instead of posting.
 *
 * What it does:
 *   1. Parses `gh pr diff` to learn which (file, line) pairs are commentable —
 *      GitHub only accepts inline review comments on lines present in the diff.
 *   2. Splits findings: anchored ones become inline comments at file:line; the
 *      rest (no file, line 0, or outside the diff) are grouped by section in the
 *      review body.
 *   3. Degrades the rich HTML+Markdown finding content to GitHub-flavored
 *      markdown (SVG diagrams dropped with a pointer to the full report, layout
 *      divs unwrapped, `path:line` refs turned into blob permalinks).
 *   4. Maps the verdict to a review event (request-changes → REQUEST_CHANGES,
 *      comment → COMMENT, approve → APPROVE). If the authenticated `gh` user IS
 *      the PR author, GitHub forbids approve/request-changes on your own PR, so
 *      the event is downgraded to COMMENT and the verdict stated in the body.
 *      The author comes from meta.author, falling back to `gh pr view --json
 *      author` when absent (meta.author is optional — without the fallback the
 *      check silently never fires and the POST 422s). If the author still can't
 *      be resolved, a warning is printed (also under --dry-run, which previews
 *      the post-downgrade event); and if GitHub still rejects the review as
 *      self-review, it is retried once as COMMENT.
 *   5. Posts everything as ONE review via `gh api` (single notification, single
 *      review thread, comments anchored to meta.headSha). The body ends with the
 *      agent-attribution footer ("🤖 Written on behalf of @<login> by <model> via
 *      <harness>" — the github-comment-attribution convention) when meta.model and
 *      meta.harness are present; the review posts under the user's account, so the
 *      footer is what tells readers an agent wrote it.
 *
 * Security: finding text is derived from an untrusted diff, but here it is only
 * DATA posted as a comment body — GitHub sanitizes comment rendering. All `gh`
 * invocations use argv arrays (no shell), and the PR number / repo slug are
 * validated before use.
 */

import { basename, dirname, join } from "node:path";

// ---------- types (subset of render.ts's schema) ----------
type Sev = "critical" | "high" | "medium" | "low" | "nitpick";
interface Finding {
  id: string;
  lens: string;
  severity: Sev;
  category: string;
  file: string;
  line: number;
  title: string;
  evidence: string;
  suggestion: string;
  featureArea: string;
  rule?: string;
  confidence?: string;
  trackedIssue?: string; // review-debt issue URL from /review-issues — see trackedLine()
}
interface Report {
  meta: {
    repo?: string;
    prNumber?: number | null;
    headSha?: string;
    author?: string;
    generatedAt?: string;
    model?: string;
    harness?: string;
  };
  verdict: { decision: string; confidence: string; summary: string };
  findings: Finding[];
}
interface ReviewComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}
export interface ReviewPayload {
  commit_id?: string;
  event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES";
  body: string;
  comments: ReviewComment[];
}

// ---------- constants ----------
const SEV_ORDER: Sev[] = ["critical", "high", "medium", "low", "nitpick"];
const SEV_DOT: Record<Sev, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  nitpick: "⚪",
};
const EVENT: Record<string, ReviewPayload["event"]> = {
  "request-changes": "REQUEST_CHANGES",
  comment: "COMMENT",
  approve: "APPROVE",
};
const VERDICT_LABEL: Record<string, string> = {
  "request-changes": "Request Changes",
  comment: "Comment",
  approve: "Approve",
};
// Same section taxonomy as render.ts — keeps the body grouped like the report.
const LENS_SECTION: Record<string, string> = {
  warm: "Dependencies",
  zombies: "Test gaps",
  preflight: "Preflight checklist",
  conventions: "Conventions",
};
const SECTION_ORDER = ["Findings", "Conventions", "Test gaps", "Preflight checklist", "Dependencies"];
const sectionOf = (f: Finding): string => LENS_SECTION[f.lens] ?? "Findings";

// --gist guard: a secret gist is PUBLIC-BY-URL, and the report embeds code
// excerpts and file paths — hosting a private repo's review there is the one
// place this pipeline can leak private source. Prose warnings get blown past;
// this refuses mechanically. Returns an error message or null.
export function gistGuardError(visibility: string, force: boolean): string | null {
  const vis = String(visibility || "").toUpperCase();
  if (vis === "PUBLIC" || force) return null;
  return (
    `--gist refused: this repo's visibility is ${vis || "UNKNOWN"} and secret gists are ` +
    `public-by-URL — hosting the report would expose review content (code excerpts, file ` +
    `paths) outside the repo's access controls. Host the report yourself and pass ` +
    `--report-url, or override deliberately with --force-gist.`
  );
}

// Last-gate stale-artifact backstop: publishing PR A's findings onto PR B is the
// disaster the Phase 0 workspace reset exists to prevent — refuse when the
// findings file and the --pr argument disagree. Returns an error message or null.
export function checkPrMismatch(
  metaPr: number | null | undefined,
  argPr: string | undefined
): string | null {
  if (!argPr || metaPr == null) return null;
  if (String(metaPr) === String(argPr)) return null;
  return (
    `findings file describes PR #${metaPr}, but --pr ${argPr} was given — refusing to publish ` +
    `another PR's findings. (Stale review-report/? Re-run the review for PR ${argPr}, or point ` +
    `at the right findings file.)`
  );
}

// Self-review downgrade: GitHub forbids APPROVE/REQUEST_CHANGES on your own PR.
// Pure so the test suite can pin the truth table; author resolution happens in main.
export function resolveEvent(
  decision: string,
  login: string,
  author: string
): { event: ReviewPayload["event"]; downgraded: boolean } {
  let event = EVENT[decision] ?? "COMMENT";
  let downgraded = false;
  if (event !== "COMMENT" && login && author && login === author) {
    event = "COMMENT";
    downgraded = true;
  }
  return { event, downgraded };
}

const sevIdx = (s: Sev): number => {
  const i = SEV_ORDER.indexOf(s);
  return i === -1 ? SEV_ORDER.indexOf("medium") : i;
};
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// GitHub caps comment/body length at 65536 chars; leave headroom.
const clip = (s: string, max = 60000): string =>
  s.length > max ? s.slice(0, max) + "\n\n…*(truncated — see the full report)*" : s;

// ---------- diff anchoring ----------
// GitHub inline review comments may only target lines that appear in the diff
// (added or context lines, RIGHT side). Parse the unified diff into a map of
// path → set of commentable new-side line numbers.
export function parseDiffAnchors(diff: string): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  let path = "";
  let newLine = 0;
  let inHunk = false;
  const add = () => {
    if (!map.has(path)) map.set(path, new Set());
    map.get(path)!.add(newLine);
  };
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      path = "";
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      path = p === "/dev/null" ? "" : p.startsWith("b/") ? p.slice(2) : p;
      inHunk = false;
      continue;
    }
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      newLine = parseInt(h[1], 10);
      inHunk = true;
      continue;
    }
    if (!inHunk || !path) continue;
    if (line.startsWith("\\")) continue; // "\ No newline at end of file"
    if (line.startsWith("-")) continue; // old side only — not RIGHT-commentable
    // "+" (added) and " " / "" (context) both exist on the new side.
    add();
    newLine++;
  }
  return map;
}

// ---------- GFM degradation ----------
// Findings carry HTML + Markdown tuned for the HTML report. GitHub comments
// render GFM plus a small HTML allowlist (class attributes stripped, no SVG,
// and markdown inside block-level HTML is NOT processed). Degrade accordingly.

// Run `fn` only on text outside ```fenced``` blocks so code examples survive.
function outsideFences(text: string, fn: (chunk: string) => string): string {
  return text
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

export function toGfm(text: string, meta: Report["meta"] = {}): string {
  return outsideFences(String(text ?? ""), (chunk) => {
    let out = chunk;
    // SVG diagrams can't render in comments — drop the subtree, point at the report.
    out = out.replace(/<svg[\s\S]*?<\/svg>/gi, "*(diagram omitted — see the full report)*");
    // Unwrap layout/rich containers (classes are stripped by GitHub anyway, and
    // block-level HTML would stop GFM from rendering the markdown inside them).
    // A closing BLOCK container becomes a paragraph break so unwrapped siblings
    // (e.g. the two children of a `cols` comparison) don't concatenate into
    // run-on text; inline <span>s unwrap silently.
    out = out.replace(/<\/(?:div|figure|figcaption|section|article|header|footer)>/gi, "\n\n");
    out = out.replace(
      /<\/?(?:div|span|figure|figcaption|section|article|header|footer)(?:\s[^>]*)?>/gi,
      ""
    );
    // `path/to/file.ts:42` → blob permalink (needs repo + headSha for stable links).
    if (meta.repo && meta.headSha) {
      out = out.replace(/`([\w./@-]+\/[\w./@-]+?\.[A-Za-z]\w{0,9})(?::(\d+))?`/g, (_m, p, ln) => {
        const anchor = ln ? `#L${ln}` : "";
        const label = ln ? `${p}:${ln}` : p;
        return `[\`${label}\`](https://github.com/${meta.repo}/blob/${meta.headSha}/${p}${anchor})`;
      });
    }
    return out;
  }).trim();
}

// ---------- review assembly ----------
function inlineCommentBody(f: Finding, meta: Report["meta"], reportUrl?: string): string {
  const parts = [`**${SEV_DOT[f.severity] ?? "🟡"} ${cap(f.severity)} · ${f.lens}** — ${f.title}`];
  if (f.rule) parts.push(`> **Rule** — ${f.rule}`);
  if (f.evidence) parts.push(toGfm(f.evidence, meta));
  if (f.suggestion) parts.push(`**Fix**\n\n${toGfm(f.suggestion, meta)}`);
  const link = reportUrl ? ` · [full report](${reportUrl}#f-${f.id})` : "";
  parts.push(`<sub>review-pr · \`${f.id}\`${link}</sub>`);
  return clip(parts.join("\n\n"));
}

function bodyFindingBlock(f: Finding, meta: Report["meta"]): string {
  const loc = f.file ? ` · <code>${f.file}${f.line > 0 ? `:${f.line}` : ""}</code>` : "";
  const inner = [
    f.rule ? `> **Rule** — ${f.rule}` : "",
    f.evidence ? toGfm(f.evidence, meta) : "",
    f.suggestion ? `**Fix**\n\n${toGfm(f.suggestion, meta)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return `<details>\n<summary>${SEV_DOT[f.severity] ?? "🟡"} <b>${f.title}</b>${loc}</summary>\n\n${inner}\n\n</details>`;
}

// A finding already filed as a review-debt issue is rendered as one line pointing
// at the tracker instead of duplicating its full prose — the issue is the canonical
// home for a low/nitpick, and double-routing it as an inline comment creates two
// untracked copies of the same debt.
function trackedLine(f: Finding): string {
  const url = f.trackedIssue ?? "";
  const num = url.match(/\/issues\/(\d+)/)?.[1];
  const label = num ? `#${num}` : "issue";
  const loc = f.file ? ` · <code>${f.file}${f.line > 0 ? `:${f.line}` : ""}</code>` : "";
  return `${SEV_DOT[f.severity] ?? "🟡"} **${f.title}**${loc} — tracked as [${label}](${url})`;
}

// Attribution footer (github-comment-attribution convention): reviews post under
// the user's own account, so the footer names the agent that wrote them. All three
// identity parts or none — a half-filled marker breaks the convention's exact,
// scannable format, so incomplete identity falls back to the plain stamp.
export function reviewFooter(meta: Report["meta"], login = ""): string {
  const date = meta.generatedAt ? ` · ${meta.generatedAt}` : "";
  if (login && meta.model && meta.harness)
    return `<sub>🤖 Written on behalf of @${login} by ${meta.model} via ${meta.harness} · review-pr${date}</sub>`;
  return `<sub>Generated by review-pr${date}</sub>`;
}

function severityTally(findings: Finding[]): string {
  const parts = SEV_ORDER.filter((s) => findings.some((f) => f.severity === s)).map(
    (s) => `${SEV_DOT[s]} ${findings.filter((f) => f.severity === s).length} ${s}`
  );
  return parts.length ? `**${findings.length} finding${findings.length === 1 ? "" : "s"}:** ${parts.join(" · ")}` : "No findings.";
}

export function buildReview(
  report: Report,
  anchors: Map<string, Set<number>>,
  opts: {
    reportUrl?: string;
    event: ReviewPayload["event"];
    downgraded?: boolean;
    bodyOnly?: boolean;
    minSeverity?: Sev;
    login?: string;
  }
): ReviewPayload {
  const meta = report.meta ?? {};
  const findings = report.findings ?? [];
  const minIdx = sevIdx(opts.minSeverity ?? "nitpick");

  // GitHub only accepts inline comments on lines present in the diff. Blockers
  // often anchor to UNCHANGED code (the retry block that predates the PR), which
  // folds the most important finding into the least visible spot. For
  // critical/high findings whose file IS in the diff, anchor to the NEAREST
  // changed line when it's close enough — beyond the cap a misleading anchor is
  // worse than the body fold, so it stays folded.
  const NEAR_LIMIT = 15;
  const anchorPlan = (f: Finding): { line: number; near: boolean } | null => {
    if (opts.bodyOnly || f.trackedIssue || !f.file || f.line <= 0 || sevIdx(f.severity) > minIdx)
      return null;
    const set = anchors.get(f.file);
    if (!set) return null;
    if (set.has(f.line)) return { line: f.line, near: false };
    if (f.severity !== "critical" && f.severity !== "high") return null;
    let best = 0;
    let bestD = Infinity;
    for (const ln of set) {
      const d = Math.abs(ln - f.line);
      if (d < bestD) {
        bestD = d;
        best = ln;
      }
    }
    return bestD <= NEAR_LIMIT ? { line: best, near: true } : null;
  };

  const planned = findings.map((f) => [f, anchorPlan(f)] as const);
  const inline = planned.filter(([, p]) => p !== null) as Array<[Finding, { line: number; near: boolean }]>;
  const inBody = planned.filter(([, p]) => p === null).map(([f]) => f);

  const comments: ReviewComment[] = inline.map(([f, p]) => ({
    path: f.file,
    line: p.line,
    side: "RIGHT",
    body:
      (p.near
        ? `> ⚠ Anchored to the nearest changed line — this finding is at \`${f.file}:${f.line}\` (${Math.abs(p.line - f.line)} line${Math.abs(p.line - f.line) === 1 ? "" : "s"} away).\n\n`
        : "") + inlineCommentBody(f, meta, opts.reportUrl),
  }));

  // ---- review body ----
  const verdictLabel = VERDICT_LABEL[report.verdict.decision] ?? cap(report.verdict.decision);
  const body: string[] = [
    `### review-pr — **${verdictLabel}** · ${report.verdict.confidence} confidence`,
  ];
  if (opts.downgraded)
    body.push(
      `> Posted as a comment (GitHub doesn't allow ${verdictLabel.toLowerCase()} on your own PR) — the review's verdict is **${verdictLabel}**.`
    );
  if (report.verdict.summary) body.push(toGfm(report.verdict.summary, meta));
  body.push(severityTally(findings));
  if (opts.reportUrl)
    body.push(
      `**[📊 Open the full HTML report](${opts.reportUrl})** — diagrams, conventions scorecard, test-gap matrix, and permalinked evidence.`
    );
  if (inline.length)
    body.push(`${inline.length} finding${inline.length === 1 ? "" : "s"} posted as inline comments on the diff.`);

  if (inBody.length) {
    body.push("---");
    for (const section of SECTION_ORDER) {
      const items = inBody.filter((f) => sectionOf(f) === section);
      if (!items.length) continue;
      items.sort((a, b) => sevIdx(a.severity) - sevIdx(b.severity));
      body.push(`#### ${section} (${items.length})`);
      body.push(items.map((f) => (f.trackedIssue ? trackedLine(f) : bodyFindingBlock(f, meta))).join("\n"));
    }
  }
  body.push(reviewFooter(meta, opts.login));

  const payload: ReviewPayload = {
    event: opts.event,
    body: clip(body.join("\n\n")),
    comments,
  };
  if (meta.headSha) payload.commit_id = meta.headSha;
  return payload;
}

// ---------- gh plumbing ----------
async function gh(args: string[], stdin?: string): Promise<string> {
  const proc = Bun.spawn(["gh", ...args], {
    stdin: stdin !== undefined ? new TextEncoder().encode(stdin) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`gh ${args.join(" ")} failed (exit ${code}): ${err.trim()}`);
  return out.trim();
}

// Host the HTML report as a secret gist, viewable via htmlpreview.github.io.
// Secret gists are unlisted but PUBLIC-BY-URL — the caller opted in with --gist.
async function hostOnGist(reportPath: string): Promise<string> {
  const out = await gh(["gist", "create", reportPath, "--desc", "review-pr report"]);
  const gistUrl = out.split("\n").pop()!.trim(); // e.g. https://gist.github.com/user/abc123
  const segs = new URL(gistUrl).pathname.split("/").filter(Boolean);
  const id = segs.pop()!;
  const user = segs.pop() ?? (await gh(["api", "user", "-q", ".login"]));
  const raw = `https://gist.githubusercontent.com/${user}/${id}/raw/${basename(reportPath)}`;
  return `https://htmlpreview.github.io/?${raw}`;
}

// ---------- main ----------
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opts: Record<string, string | boolean> = {};
  let findingsPath = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "--body-only" || a === "--gist" || a === "--force-gist")
      opts[a.slice(2)] = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i] ?? "";
    else findingsPath = a;
  }
  if (!findingsPath) {
    console.error(
      "usage: bun run publish.ts <findings.json> [--pr N] [--repo owner/name] [--report-url URL] [--gist] [--report path] [--min-severity sev] [--body-only] [--dry-run]"
    );
    process.exit(1);
  }

  const report: Report = JSON.parse(await Bun.file(findingsPath).text());
  report.meta ??= {};
  report.verdict ??= { decision: "comment", confidence: "low", summary: "" };
  report.findings ??= [];

  const repo = String(opts["repo"] ?? report.meta.repo ?? "");
  const pr = String(opts["pr"] ?? report.meta.prNumber ?? "");
  // Untrusted-input hygiene (same posture as SKILL.md Phase 0): strict shapes only.
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    console.error(`No valid repo slug (got "${repo}") — pass --repo owner/name or use PR-mode findings.`);
    process.exit(1);
  }
  if (!/^\d+$/.test(pr)) {
    console.error(`No valid PR number (got "${pr}") — pass --pr N or use PR-mode findings.`);
    process.exit(1);
  }
  const mismatch = checkPrMismatch(report.meta.prNumber, opts["pr"] as string | undefined);
  if (mismatch) {
    console.error(`✗ ${mismatch}`);
    process.exit(1);
  }
  const minSeverity = opts["min-severity"] as Sev | undefined;
  if (minSeverity && !SEV_ORDER.includes(minSeverity)) {
    console.error(`--min-severity must be one of: ${SEV_ORDER.join(", ")}`);
    process.exit(1);
  }

  let reportUrl = (opts["report-url"] as string) || undefined;
  if (opts["gist"]) {
    const visibility = await gh(["repo", "view", repo, "--json", "visibility", "-q", ".visibility"]).catch(
      () => ""
    );
    const guard = gistGuardError(visibility, !!opts["force-gist"]);
    if (guard) {
      console.error(`✗ ${guard}`);
      process.exit(1);
    }
    const reportPath = (opts["report"] as string) || join(dirname(findingsPath), "report.html");
    reportUrl = await hostOnGist(reportPath);
    console.log(`✓ report hosted: ${reportUrl}`);
  }

  const diff = await gh(["pr", "diff", pr, "--repo", repo]);
  const anchors = parseDiffAnchors(diff);

  // The posting account feeds both the self-review check and the attribution
  // footer — resolve it once, up front.
  const login = await gh(["api", "user", "-q", ".login"]).catch(() => "");

  let event = EVENT[report.verdict.decision] ?? "COMMENT";
  let downgraded = false;
  if (event !== "COMMENT") {
    // GitHub rejects APPROVE / REQUEST_CHANGES on your own PR. meta.author is
    // OPTIONAL in the schema — without the gh fallback, a missing author makes
    // the comparison silently never match and the POST fails with a bare 422.
    const author =
      report.meta.author ||
      (await gh(["pr", "view", pr, "--repo", repo, "--json", "author", "-q", ".author.login"]).catch(
        () => ""
      ));
    ({ event, downgraded } = resolveEvent(report.verdict.decision, login, author));
    if (event !== "COMMENT" && (!login || !author)) {
      console.error(
        `⚠ cannot check the self-review rule (${!login ? "gh login unknown" : "PR author unknown"}) — ` +
          `posting ${event}; GitHub rejects it with HTTP 422 if this is your own PR.`
      );
    }
  }

  const buildOpts = { reportUrl, bodyOnly: !!opts["body-only"], minSeverity, login };
  let payload = buildReview(report, anchors, { ...buildOpts, event, downgraded });

  if (opts["dry-run"]) {
    // stdout stays pure JSON (parseable); notes go to stderr. The payload shown
    // is post-downgrade — exactly what a real run would POST.
    if (downgraded)
      console.error(`ℹ event downgraded to COMMENT (you are the PR author) — dry run previews the downgraded payload.`);
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  let res: string;
  try {
    res = await gh(
      ["api", `repos/${repo}/pulls/${pr}/reviews`, "--input", "-"],
      JSON.stringify(payload)
    );
  } catch (e) {
    const msg = (e as Error).message;
    // Belt and suspenders: if GitHub still rejects it as self-review (author
    // resolution failed or lied), downgrade and retry once.
    if (payload.event !== "COMMENT" && /own pull request/i.test(msg)) {
      console.error(`⚠ GitHub rejected ${payload.event} (own PR) — retrying as COMMENT with the verdict stated in the body.`);
      payload = buildReview(report, anchors, { ...buildOpts, event: "COMMENT", downgraded: true });
      res = await gh(
        ["api", `repos/${repo}/pulls/${pr}/reviews`, "--input", "-"],
        JSON.stringify(payload)
      );
    } else {
      throw e;
    }
  }
  const url = (() => {
    try {
      return JSON.parse(res).html_url ?? "";
    } catch {
      return "";
    }
  })();
  console.log(
    `✓ posted ${payload.event} review with ${payload.comments.length} inline comment${
      payload.comments.length === 1 ? "" : "s"
    }${url ? `: ${url}` : ""}`
  );
}
