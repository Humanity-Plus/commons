#!/usr/bin/env bun
/**
 * render.ts — turn a review findings.json into a self-contained HTML report.
 *
 * Usage:  bun run render.ts <findings.json> [report.html]
 *
 * Input shape (findings.json):
 * {
 *   "meta": {
 *     "mode": "pr" | "local",
 *     "title": string, "author": string,
 *     "base": string, "head": string, "headSha": string,
 *     "repo": string,            // "owner/name", for permalinks ("" if unknown)
 *     "prNumber": number | null, "url": string,
 *     "filesChanged": number, "additions": number, "deletions": number,
 *     "generatedAt": string,     // ISO; the skill stamps this
 *     "lenses"?: [{ "name": string, "status": "ran"|"skipped", "note"?: string }],
 *     "sharding"?: { "sharded": boolean, "threshold": number, "areas": string[] },
 *                                // recorded when Phase 2 ran per-feature-area shards
 *     "holistic"?: { "lensesOnly": number, "holisticOnly": number, "both": number }
 *                                // overlap stats when the --holistic branch ran
 *   },
 *   "verdict": { "decision": "approve"|"comment"|"request-changes",
 *                "confidence": "high"|"medium"|"low", "summary": string },
 *   "triage": {
 *     "groups": [{ "name": string, "risk": "high"|"medium"|"low",
 *                  "reason": string, "files": [{ "path": string, "status": string }] }],
 *     "skipped": string[]
 *   },
 *   "scorecard"?: [{ "area": string, "status": "pass"|"warn"|"fail"|"na",
 *                    "note": string, "findingIds"?: string[] }],  // conventions lens
 *   "systemChange"?: {                                    // primitives lens
 *     "mapPath"?: string, "overall"?: "composes"|"extends"|"adds",
 *     "mapUpdated"?: boolean,
 *     "primitives": [{ "id", "name", "area"?, "classification",
 *                      "files"?, "invariantsTouched"?, "relatesTo"?, "note"? }],
 *     "added"?: [{ "name", "files"?, "note"? }]
 *   },
 *   "findings": Finding[],       // standard schema + lens-specific extras
 *   "limitations": string[]
 * }
 *
 * A Finding: { id, lens, severity, category, file, line, title, evidence,
 *   suggestion, featureArea, verified? } — lens is one of: triage | first-five |
 *   conventions | warm | zombies | preflight | intent | seams | holistic | merge
 *   (merge = Phase 0 conflict-probe findings; unlisted lens names render in the
 *   generic Findings section). Plus, per lens:
 *   warm:        { warm:{worth,alive,rightSized,secure}, ecosystem, changeType, packageVerdict }
 *   zombies:     { zombiesLetter, partial }
 *   preflight:   { confidence }
 *   any lens:    { verifiable? }  // the exact command/query/place that settles
 *                              // the finding (vs. a pure human judgment call,
 *                              // which omits it)
 *   conventions: { rule }   // cited repo rule as one "path: gist" string
 * Optional skill-added fields (absent on the default small-PR path — the skill,
 * not the lenses, sets these):
 *   area?:        string                  // feature-area shard that produced it (sharded runs)
 *   locations?:   [{ file, line, note? }] // a grouped finding's every occurrence (arbiter);
 *                                         //   rendered as one card with a location list.
 *                                         //   note = optional one-line per-site gap/fix
 *   regradeNote?: string                  // arbiter's justification for a severity regrade
 *   folded?:      boolean                 // beyond the report budget — rendered in the
 *                                         //   collapsed "More findings" section, never dropped
 *   source?:      "lenses"|"holistic"|"both"  // origin when the --holistic branch ran
 *   trackedIssue?: string                 // URL of the review-debt issue /review-issues
 *                                         //   filed for it — rendered as a linked chip;
 *                                         //   publish.ts posts a one-liner instead of prose
 *   verifiedBy?:  "mechanical"|"experiment"|"documentation"|"skeptic"|"advisory"
 *                                         // which verify bucket settled it (pass-through
 *                                         //   for resolve-review; not rendered)
 *
 * Rich content: `evidence`, `suggestion`, and `verdict.summary` accept **native
 * HTML + inline CSS** (including inline `<svg>` for diagrams) AND a Markdown
 * convenience layer (paragraphs, `#`/`##`/`###` headings, `-`/`1.` lists,
 * **bold**, *italic*, `inline code`, pipe tables, [links](https://…), and
 * ```fenced``` code — ```diff blocks are +/- colorized). Reusable component
 * classes are shipped in CSS: `callout note|warn|danger|ok`, `cols`/`cols-3`,
 * `panel`, `badge red|green|amber|blue`, `diagram`.
 *
 * SECURITY: this text is derived from an UNTRUSTED diff and the report opens in a
 * browser, so ALL of it passes through an allowlist sanitizer (`sanitizeHtml`):
 * unknown tags are dropped, dangerous subtrees (script/style/iframe/…) are removed
 * whole, and event handlers + `javascript:`/remote-`url()` values are stripped.
 * The agent gets full visual expression; nothing from the diff can execute.
 * `title` and other short fields stay plain text.
 */

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
  verified?: boolean;
  // extras
  warm?: { worth: Mark; alive: Mark; rightSized: Mark; secure: Mark };
  ecosystem?: string;
  changeType?: string;
  packageVerdict?: string;
  zombiesLetter?: string;
  partial?: boolean;
  confidence?: string;
  verifiable?: string;
  rule?: string;
  // skill-added optionals (absent on the default path)
  area?: string;
  locations?: Array<{ file: string; line: number; note?: string }>;
  regradeNote?: string;
  folded?: boolean;
  source?: "lenses" | "holistic" | "both";
  trackedIssue?: string;
  verifiedBy?: "mechanical" | "experiment" | "documentation" | "skeptic" | "advisory";
}
type Mark = "pass" | "warn" | "fail" | "unknown";
type ScoreStatus = "pass" | "warn" | "fail" | "na";
interface ScoreItem {
  area: string;
  status: ScoreStatus;
  note: string;
  findingIds?: string[];
}

interface Meta {
  mode?: "pr" | "local";
  title?: string;
  author?: string;
  base?: string;
  head?: string;
  headSha?: string;
  repo?: string; // "owner/name", for permalinks ("" / undefined if unknown)
  prNumber?: number | null;
  url?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  generatedAt?: string;
  lenses?: Array<{ name: string; status: "ran" | "skipped"; note?: string }>;
  sharding?: { sharded: boolean; threshold?: number; areas?: string[] };
  holistic?: { lensesOnly: number; holisticOnly: number; both: number };
}

type Classification = "composes" | "extends" | "adds";

interface SystemChangePrimitive {
  id: string;
  name: string;
  area?: string;
  classification: Classification;
  files?: string[];
  invariantsTouched?: string[];
  relatesTo?: string[];
  note?: string;
}

interface SystemChange {
  mapPath?: string;
  overall?: Classification;
  mapUpdated?: boolean;
  primitives: SystemChangePrimitive[];
  added?: Array<{ name: string; files?: string[]; note?: string }>;
}

interface Report {
  meta: Meta;
  verdict: { decision: string; confidence: string; summary: string };
  triage: { groups: any[]; skipped: string[] };
  scorecard?: ScoreItem[];
  systemChange?: SystemChange;
  findings: Finding[];
  limitations?: string[];
}

// ---------- input validation ----------
// Fail LOUDLY on a structurally malformed report. The defensive defaults in main
// are for genuinely ABSENT sections; silently "repairing" wrong shapes (e.g. a
// flat string `verdict`) renders "undefined · undefined confidence" instead of an
// error — a field-reported failure mode. Returns a list of problems; empty = ok.
export function validateReport(r: any): string[] {
  const isObj = (v: any) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!isObj(r)) return ["report root must be a JSON object"];
  const errs: string[] = [];
  if (r.meta !== undefined && !isObj(r.meta)) errs.push("meta must be an object");
  if (r.verdict !== undefined) {
    if (!isObj(r.verdict))
      errs.push(
        `verdict must be an object { decision, confidence, summary } — got ${Array.isArray(r.verdict) ? "array" : typeof r.verdict}`
      );
    else if (typeof r.verdict.decision !== "string" || !r.verdict.decision)
      errs.push('verdict.decision is missing — expected "approve" | "comment" | "request-changes"');
  }
  if (r.findings !== undefined && !Array.isArray(r.findings)) errs.push("findings must be an array");
  if (r.triage !== undefined && (!isObj(r.triage) || (r.triage.groups !== undefined && !Array.isArray(r.triage.groups))))
    errs.push("triage must be an object whose groups (if present) is an array");
  if (r.scorecard !== undefined && !Array.isArray(r.scorecard)) errs.push("scorecard must be an array");
  if (r.systemChange !== undefined) {
    if (!isObj(r.systemChange) || !Array.isArray(r.systemChange.primitives))
      errs.push("systemChange must be an object whose primitives is an array");
  }
  return errs;
}

// ---------- constants ----------
const SEV_ORDER: Sev[] = ["critical", "high", "medium", "low", "nitpick"];
const SEV: Record<Sev, { label: string; color: string; dot: string }> = {
  critical: { label: "Critical", color: "#ff8589", dot: "🔴" },
  high: { label: "High", color: "#ffa057", dot: "🟠" },
  medium: { label: "Medium", color: "#f2c063", dot: "🟡" },
  low: { label: "Low", color: "#6ea8fe", dot: "🔵" },
  nitpick: { label: "Nitpick", color: "#8b8d98", dot: "⚪" },
};
const RISK: Record<string, string> = { high: "#ff8589", medium: "#f2c063", low: "#5fd39a" };
// System-change classification (primitives lens): adds > extends > composes.
const CLASSIFICATION: Record<Classification, { label: string; color: string }> = {
  adds: { label: "Adds", color: "#ff8589" },
  extends: { label: "Extends", color: "#f2c063" },
  composes: { label: "Composes", color: "#5fd39a" },
};
const MARK: Record<Mark, { g: string; c: string }> = {
  pass: { g: "✓", c: "#5fd39a" },
  warn: { g: "!", c: "#f2c063" },
  fail: { g: "✕", c: "#ff8589" },
  unknown: { g: "?", c: "#8b8d98" },
};
const ZLET = ["Z", "O", "M", "B", "I", "E", "S"];
const VERDICT: Record<string, { label: string; color: string }> = {
  "request-changes": { label: "Request Changes", color: "#ff8589" },
  comment: { label: "Comment", color: "#f2c063" },
  approve: { label: "Approve", color: "#5fd39a" },
};

// ---------- helpers ----------
const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Only allow http(s) URLs into href attributes. esc() prevents attribute breakout
// but not dangerous schemes (javascript:, data:, vbscript:), which stay clickable.
const safeUrl = (u: unknown): string => {
  const s = String(u ?? "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
};

function permalink(m: Meta, file: string, line: number): string {
  if (!file || !m.repo || !m.headSha) return "";
  const anchor = line > 0 ? `#L${line}` : "";
  return `https://github.com/${m.repo}/blob/${m.headSha}/${file}${anchor}`;
}

function fileRef(m: Meta, file: string, line: number): string {
  if (!file) return "";
  const label = line > 0 ? `${file}:${line}` : file;
  const url = safeUrl(permalink(m, file, line));
  return url
    ? `<a class="ref" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`
    : `<span class="ref">${esc(label)}</span>`;
}

// ---------- rich content (sanitized HTML + Markdown convenience) ----------
// `evidence`, `suggestion`, and the verdict summary may contain **native HTML +
// inline CSS** (incl. SVG for diagrams) so the agent has real visual expression,
// AND Markdown for convenience. Because that text is derived from an UNTRUSTED diff
// and the report opens in a browser, everything is run through an allowlist
// sanitizer: unknown tags are dropped, dangerous ones (script/style/iframe/…) are
// removed with their content, event handlers and javascript:/remote-url values are
// stripped. So the agent can express anything visual, but nothing can execute.

// ----- HTML sanitizer -----
// Immutable allowlists — typed ReadonlySet so accidental add/delete is a compile error.
const OK_TAGS: ReadonlySet<string> = new Set(
  ("p br hr div span section article aside header footer main nav " +
    "h1 h2 h3 h4 h5 h6 ul ol li dl dt dd blockquote pre code kbd samp var tt " +
    "strong b em i u s del ins mark sub sup small abbr cite q time wbr bdi bdo " +
    "a figure figcaption details summary caption label progress meter " +
    "table thead tbody tfoot tr th td colgroup col " +
    // SVG subset for diagrams (no use/image/foreignObject/script/animate)
    "svg g path rect circle ellipse line polyline polygon text tspan textpath " +
    "defs marker lineargradient radialgradient stop clippath pattern title desc")
    .split(" ")
);
// HTML void elements — emitted self-closing.
const VOID: ReadonlySet<string> = new Set("br hr col wbr".split(" "));
// Elements whose *entire subtree* is discarded (never just unwrapped).
const DROP_TREE: ReadonlySet<string> = new Set(
  ("script style iframe object embed noscript template form input textarea select " +
    "option button link meta base foreignobject use image animate animatetransform " +
    "animatemotion set audio video source track applet param")
    .split(" ")
);
// Global attribute allowlist (lowercased). `href` (on <a>) and data-/aria-* handled separately.
const OK_ATTR: ReadonlySet<string> = new Set(
  ("class id title role style dir lang tabindex colspan rowspan headers scope value max " +
    "datetime cite " +
    // SVG geometry / presentation
    "viewbox xmlns x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width " +
    "stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity " +
    "fill-opacity stroke-opacity fill-rule transform text-anchor dominant-baseline " +
    "alignment-baseline font-size font-family font-weight letter-spacing offset " +
    "stop-color stop-opacity gradientunits gradienttransform spreadmethod " +
    "clippathunits patternunits marker-end marker-start marker-mid orient markerwidth " +
    "markerheight refx refy preserveaspectratio patterncontentunits width height")
    .split(" ")
);
const STYLE_BAD = /(url\s*\(|image-set|-webkit-image-set|element\s*\(|expression|javascript:|@import|<|>)/i;
function sanitizeStyle(v: string): string {
  return v
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 1) return false;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1).trim();
      if (!/^-?[a-z][a-z-]*$/.test(prop)) return false;
      if (/^(behavior|-moz-binding|-o-link|-o-link-source)$/.test(prop)) return false;
      // Block layout-escape: only static/relative positioning stays inside the card.
      if (prop === "position" && !/^(static|relative)$/i.test(val)) return false;
      if (STYLE_BAD.test(val)) return false;
      return true;
    })
    .join("; ");
}
// A value that names a URL: allow only a local SVG fragment `url(#id)`; block remote.
const badGenericVal = (v: string) => /javascript:/i.test(v) || (/url\(/i.test(v) && !/^url\(#[\w-]+\)$/i.test(v.trim()));
function sanitizeAttrs(raw: string, tag: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const orig = m[1]; // preserve case so SVG camelCase (viewBox, markerWidth) survives
    const name = orig.toLowerCase();
    let val = m[2] ?? "";
    if (val.startsWith('"') || val.startsWith("'")) val = val.slice(1, -1);
    if (name.startsWith("on")) continue; // never allow event handlers
    if (name === "href") {
      if (tag !== "a") continue;
      const u = /^#[\w-]+$/.test(val) ? val : safeUrl(val.replace(/&amp;/g, "&"));
      if (u) out.push(`href="${esc(u)}" target="_blank" rel="noopener nofollow"`);
      continue;
    }
    const ok = OK_ATTR.has(name) || /^(data|aria)-[a-z][\w-]*$/.test(name);
    if (!ok) continue;
    if (name === "style") {
      const st = sanitizeStyle(val);
      if (st) out.push(`style="${esc(st)}"`);
      continue;
    }
    if (badGenericVal(val)) continue;
    out.push(val === "" ? orig : `${orig}="${esc(val)}"`);
  }
  return out.length ? " " + out.join(" ") : "";
}
// Turn arbitrary HTML into a safe subset: escape text, allowlist tags+attrs, drop
// dangerous subtrees. The core security guarantee of the rich-content pipeline.
function sanitizeHtml(input: string): string {
  let s = String(input ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\?[\s\S]*?\?>/g, "");
  const out: string[] = [];
  const dropStack: string[] = [];
  const re = /<\/?([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const full = m[0];
    const name = m[1].toLowerCase();
    if (!dropStack.length) out.push(esc(s.slice(last, m.index)));
    last = re.lastIndex;
    const isClose = full.startsWith("</");
    const selfClose = /\/\s*>$/.test(full) || VOID.has(name);
    if (dropStack.length) {
      if (isClose && name === dropStack[dropStack.length - 1]) dropStack.pop();
      else if (!isClose && !selfClose && name === dropStack[dropStack.length - 1]) dropStack.push(name);
      continue; // inside a dropped subtree: emit nothing
    }
    if (DROP_TREE.has(name)) {
      if (!isClose && !selfClose) dropStack.push(name);
      continue;
    }
    if (!OK_TAGS.has(name)) continue; // unknown tag: drop tag, keep inner text
    if (isClose) {
      out.push(`</${m[1]}>`);
      continue;
    }
    out.push(`<${m[1]}${sanitizeAttrs(m[2] || "", name)}${selfClose ? " />" : ">"}`);
  }
  if (!dropStack.length) out.push(esc(s.slice(last)));
  return out.join("");
}

// ----- file/line references & code -----
// Source-file extensions we recognise, so a backticked `foo.get` (member access)
// isn't mistaken for a filename while `charge.ts` / `a/b.js:42` are.
const CODE_EXT = new Set(
  ("ts tsx js jsx mjs cjs json jsonc md mdx sql py go rs rb java kt swift c h cc cpp hpp cs php " +
    "css scss sass less html htm vue svelte yml yaml toml ini env sh bash zsh txt lock gradle xml proto graphql prisma")
    .split(" ")
);
function classifyRef(token: string): { path: string; line: number } | null {
  const mm = token.match(/^([\w./@-]+?\.[A-Za-z][\w]{0,9})(?::(\d+)(?:-\d+)?)?$/);
  if (!mm) return null;
  const path = mm[1];
  const ext = (path.split(".").pop() || "").toLowerCase();
  const isFile = !!mm[2] || path.includes("/") || CODE_EXT.has(ext);
  return isFile ? { path, line: mm[2] ? parseInt(mm[2], 10) : 0 } : null;
}
// Render backtick content: a file/line ref (linked, blue) or an inline code chip.
// `content` is ALREADY html-escaped. Result is trusted (bypasses the sanitizer).
function inlineCode(escaped: string, m: Meta): string {
  const ref = classifyRef(escaped);
  if (ref) {
    const ln = ref.line > 0 ? `<span class="ln">:${ref.line}</span>` : "";
    const url = ref.path.includes("/") ? safeUrl(permalink(m, ref.path, ref.line)) : "";
    const label = `${ref.path.split("/").pop()}${ln}`;
    return url
      ? `<a class="md-file" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(ref.path)}">${label}</a>`
      : `<span class="md-file" title="${esc(ref.path)}">${label}</span>`;
  }
  return `<code class="md-code">${escaped}</code>`;
}
function codeBlock(escapedCode: string, lang: string): string {
  if (lang === "diff") {
    const rows = escapedCode
      .split("\n")
      .map((l) => {
        const cls = l.startsWith("+") ? "diff-add" : l.startsWith("-") ? "diff-del" : l.startsWith("@@") ? "diff-hunk" : "";
        return `<span class="dl ${cls}">${l || " "}</span>`;
      })
      // No "\n" separator: the spans are display:block, so a literal newline inside
      // the white-space:pre <code> would render as an extra blank (unstyled) line.
      .join("");
    return `<pre class="md-pre md-diff"><code>${rows}</code></pre>`;
  }
  const tag = lang ? ` data-lang="${esc(lang)}"` : "";
  return `<pre class="md-pre"${tag}><code>${escapedCode}</code></pre>`;
}

// ----- Markdown convenience layer -----
// Emits HTML tags WITHOUT escaping so author raw HTML survives to the sanitizer.
// Code (fenced + inline) is tokenized out via `tok` and reinserted post-sanitize.
type Tok = (html: string) => string;
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const splitRow = (l: string) =>
  l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function mdInlineFmt(raw: string, m: Meta, tok: Tok): string {
  return raw
    .split("`")
    .map((seg, i) => {
      if (i % 2 === 1) return tok(inlineCode(esc(seg), m)); // code span: escaped + protected
      let out = seg.replace(/\*\*([^*]+)\*\*/g, (_x, c) => `<strong>${c}</strong>`);
      out = out.replace(/\*([^*\n]+)\*/g, (_x, c) => `<em>${c}</em>`);
      out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_x, t, u) =>
        safeUrl(String(u)) ? `<a href="${safeUrl(String(u))}">${t}</a>` : `[${t}](${u})`
      );
      return out;
    })
    .join("");
}

// End index (exclusive) of a raw HTML block starting at `start`. Tracks the depth of
// the block's root tag so a multi-line diagram/figure with INTERNAL BLANK LINES and
// nested same-name tags (e.g. `<div class="cols"><div>…</div></div>`) is captured
// verbatim instead of being split at the first blank line.
function endOfHtmlBlock(lines: string[], start: number): number {
  const open = lines[start].match(/^\s*<([a-zA-Z][\w:-]*)/);
  const root = open ? open[1].toLowerCase() : "";
  // Closing tag, void root, or unparseable start: fall back to blank-line delimiting.
  if (!root || VOID.has(root) || /^\s*<\//.test(lines[start])) {
    let j = start;
    while (j < lines.length && !/^\s*$/.test(lines[j])) j++;
    return j;
  }
  const openRe = new RegExp(`<${root}(?=[\\s/>])`, "gi");
  const closeRe = new RegExp(`</${root}(?=[\\s>])`, "gi");
  const selfRe = new RegExp(`<${root}\\b[^>]*/>`, "gi");
  let depth = 0;
  let j = start;
  do {
    const l = lines[j++];
    depth += (l.match(openRe) || []).length - (l.match(selfRe) || []).length - (l.match(closeRe) || []).length;
  } while (j < lines.length && depth > 0);
  return j;
}

function mdToHtml(text: string, m: Meta, tok: Tok): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  const blank = (l: string) => /^\s*$/.test(l);
  const table = (n: number) => !!lines[n] && lines[n].includes("|") && n + 1 < lines.length && isTableSep(lines[n + 1]);
  const htmlBlock = (l: string) => /^\s*<\/?[a-zA-Z][\w:-]*(\s|>|\/>|$)/.test(l);
  const startsBlock = (n: number) =>
    /^\s*```/.test(lines[n]) ||
    /^#{1,3}\s/.test(lines[n]) ||
    /^\s*[-*]\s+/.test(lines[n]) ||
    /^\s*\d+\.\s+/.test(lines[n]) ||
    table(n) ||
    htmlBlock(lines[n]);
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w+)?\s*$/);
    if (fence) {
      const lang = (fence[1] || "").toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(tok(codeBlock(esc(buf.join("\n")), lang)));
      continue;
    }
    if (htmlBlock(line)) {
      // Author raw HTML block — passes through verbatim to the sanitizer (no md inside).
      // Consume the whole element (incl. internal blank lines) so diagrams stay intact.
      const end = endOfHtmlBlock(lines, i);
      out.push(lines.slice(i, end).join("\n"));
      i = end;
      continue;
    }
    if (table(i)) {
      const head = splitRow(line).map((c) => `<th>${mdInlineFmt(c, m, tok)}</th>`).join("");
      i += 2;
      const body: string[] = [];
      while (i < lines.length && lines[i].includes("|") && !blank(lines[i]))
        body.push(`<tr>${splitRow(lines[i++]).map((c) => `<td>${mdInlineFmt(c, m, tok)}</td>`).join("")}</tr>`);
      out.push(`<table class="md-table"><thead><tr>${head}</tr></thead><tbody>${body.join("")}</tbody></table>`);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      out.push(`<div class="md-h md-h${h[1].length}">${mdInlineFmt(h[2], m, tok)}</div>`);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]))
        items.push(`<li>${mdInlineFmt(lines[i++].replace(/^\s*[-*]\s+/, ""), m, tok)}</li>`);
      out.push(`<ul class="md-list">${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]))
        items.push(`<li>${mdInlineFmt(lines[i++].replace(/^\s*\d+\.\s+/, ""), m, tok)}</li>`);
      out.push(`<ol class="md-list">${items.join("")}</ol>`);
      continue;
    }
    if (blank(line)) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !blank(lines[i]) && !startsBlock(i)) para.push(lines[i++]);
    out.push(`<p>${mdInlineFmt(para.join(" "), m, tok)}</p>`);
  }
  return out.join("\n");
}

function withTokens(fn: (tok: Tok) => string): string {
  const store: string[] = [];
  const html = fn((h) => `\uE000${store.push(h) - 1}\uE001`);
  return sanitizeHtml(html).replace(/\uE000(\d+)\uE001/g, (_x, n) => store[Number(n)] ?? "");
}
// Block-level field: Markdown + author HTML/SVG, sanitized. Pass `m` for permalinks.
function renderRich(src: unknown, m: Meta = {}): string {
  const text = String(src ?? "");
  return text.trim() ? withTokens((tok) => mdToHtml(text, m, tok)) : "";
}
// Inline field (table cells, notes): inline Markdown + author HTML, sanitized.
function renderInline(src: unknown, m: Meta = {}): string {
  const text = String(src ?? "");
  return text.trim() ? withTokens((tok) => mdInlineFmt(text, m, tok)) : "";
}

// ---------- section taxonomy ----------
// Which report section a finding belongs to, keyed by lens. Drives the
// composition breakdown, section anchors, and per-section counts.
type SectionKey = "findings" | "conventions" | "tests" | "preflight" | "deps";
const SECTIONS: Record<SectionKey, { label: string; anchor: string; tag: string; desc: string }> = {
  findings: { label: "Findings", anchor: "findings", tag: "", desc: "code issues & bugs" },
  conventions: { label: "Conventions", anchor: "conventions", tag: "CRAFT", desc: "convention & craft issues" },
  tests: { label: "Test gaps", anchor: "tests", tag: "ZOMBIES", desc: "missing high-value tests" },
  preflight: { label: "Preflight", anchor: "preflight", tag: "before merge", desc: "deploy checklist items" },
  deps: { label: "Dependencies", anchor: "deps", tag: "WARM", desc: "new / upgraded packages" },
};
// Lens → section. Unlisted lenses (first-five, intent, …) fall back to "findings",
// so adding a new lens's section is a one-line change here.
const LENS_SECTION: Record<string, SectionKey> = {
  warm: "deps",
  zombies: "tests",
  preflight: "preflight",
  conventions: "conventions",
};
const sectionOf = (f: Finding): SectionKey => LENS_SECTION[f.lens] ?? "findings";

// ---------- charts ----------
function donut(counts: Record<Sev, number>): string {
  const total = SEV_ORDER.reduce((a, s) => a + counts[s], 0);
  const R = 52, C = 2 * Math.PI * R, cx = 70, cy = 70;
  if (total === 0) {
    return `<svg viewBox="0 0 140 140" class="donut" role="img" aria-label="No findings">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#24262f" stroke-width="16"/>
      <text x="${cx}" y="${cy - 2}" class="donut-num">0</text>
      <text x="${cx}" y="${cy + 16}" class="donut-lbl">findings</text></svg>`;
  }
  let offset = 0;
  const segs = SEV_ORDER.filter((s) => counts[s] > 0)
    .map((s) => {
      const frac = counts[s] / total;
      const len = frac * C;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none"
        stroke="${SEV[s].color}" stroke-width="16"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cy})"><title>${SEV[s].label}: ${counts[s]}</title></circle>`;
      offset += len;
      return seg;
    })
    .join("");
  return `<svg viewBox="0 0 140 140" class="donut" role="img" aria-label="Findings by severity">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#24262f" stroke-width="16"/>
    ${segs}
    <text x="${cx}" y="${cy - 2}" class="donut-num">${total}</text>
    <text x="${cx}" y="${cy + 16}" class="donut-lbl">findings</text></svg>`;
}

function severityLegend(counts: Record<Sev, number>): string {
  return `<ul class="legend">${SEV_ORDER.map(
    (s) =>
      `<li><span class="swatch" style="background:${SEV[s].color}"></span>
        <span class="legend-lbl">${SEV[s].label}</span>
        <span class="legend-num">${counts[s]}</span></li>`
  ).join("")}</ul>`;
}

// Breakdown of findings by destination section — answers "where do the N total
// findings actually live?" so a big donut number doesn't imply N code findings.
function composition(findings: Finding[]): string {
  const rows = (Object.keys(SECTIONS) as SectionKey[])
    .map((key) => {
      const meta = SECTIONS[key];
      const items = findings.filter((f) => sectionOf(f) === key);
      const n = items.length;
      const sevs = SEV_ORDER.filter((s) => items.some((f) => f.severity === s))
        .map((s) => {
          const c = items.filter((f) => f.severity === s).length;
          return `<span class="mini-sev" style="--c:${SEV[s].color}" title="${c} ${SEV[s].label}">${c}</span>`;
        })
        .join("");
      return `<a class="comp-row${n ? "" : " comp-empty"}" href="#${meta.anchor}">
        <span class="comp-count">${n}</span>
        <span class="comp-body">
          <span class="comp-name">${meta.label}${
        meta.tag ? ` <span class="comp-tag">${esc(meta.tag)}</span>` : ""
      }</span>
          <span class="comp-desc">${esc(meta.desc)}</span>
        </span>
        <span class="comp-sevs">${n ? sevs : `<span class="comp-none">none</span>`}</span>
      </a>`;
    })
    .join("");
  return `<div class="composition">${rows}</div>`;
}

// small pill showing a section's finding count next to its <h2>
const countBadge = (n: number): string =>
  `<span class="head-count"${n ? "" : ` data-zero="1"`}>${n}</span>`;

function heatmap(groups: any[]): string {
  if (!groups.length) return `<p class="empty">No feature areas.</p>`;
  return `<div class="heatmap">${groups
    .map((g) => {
      const c = RISK[g.risk] ?? "#8b8d98";
      return `<div class="heat-cell" style="--risk:${c}">
        <div class="heat-risk">${esc(g.risk)}</div>
        <div class="heat-name">${esc(g.name)}</div>
        <div class="heat-files">${g.files.length} file${g.files.length === 1 ? "" : "s"}</div>
      </div>`;
    })
    .join("")}</div>`;
}

function zombiesMatrix(findings: Finding[], groups: any[]): string {
  const zf = findings.filter((f) => f.lens === "zombies" && !f.folded);
  if (!zf.length) return "";
  const areas = groups.length
    ? groups.map((g) => g.name)
    : [...new Set(zf.map((f) => f.featureArea || "General"))];
  const cell = (area: string, letter: string) => {
    const hits = zf.filter(
      (f) => (f.featureArea || "General") === area && (f.zombiesLetter || "").toUpperCase() === letter
    );
    if (!hits.length) return `<td class="zc"></td>`;
    const partial = hits.some((h) => h.partial);
    return `<td class="zc zc-on${partial ? " zc-partial" : ""}" title="${esc(
      hits.map((h) => h.title).join("; ")
    )}">${hits.length}</td>`;
  };
  return `<table class="zmatrix">
    <thead><tr><th>Feature area</th>${ZLET.map((l) => `<th title="${zName(l)}">${l}</th>`).join("")}</tr></thead>
    <tbody>${areas
      .map((a) => `<tr><td class="zarea">${esc(a)}</td>${ZLET.map((l) => cell(a, l)).join("")}</tr>`)
      .join("")}</tbody></table>
    <p class="matrix-key">Cells show suggested tests per category. <span class="zc-partial-key"></span> = partial coverage exists.</p>`;
}
const zName = (l: string) =>
  ({ Z: "Zero", O: "One", M: "Many", B: "Boundaries", I: "Interface", E: "Exceptions", S: "Simple" }[l] ?? l);
const zDesc: Record<string, string> = {
  Z: "absent / empty inputs",
  O: "single input, happy path",
  M: "multiples, ordering, concurrency",
  B: "limits & off-by-one",
  I: "public API contract & return types",
  E: "failures, invalid or expired state",
  S: "everyday paths real users follow",
};

function zombiesKey(): string {
  return `<dl class="zkey">${ZLET.map(
    (l) => `<div class="zkey-item"><dt>${l}</dt><dd><b>${zName(l)}</b> — ${esc(zDesc[l])}</dd></div>`
  ).join("")}</dl>`;
}

// ---------- sections ----------
function verdictBadge(v: Report["verdict"]): string {
  const meta = VERDICT[v.decision] ?? { label: v.decision, color: "#8b8d98" };
  return `<div class="verdict" style="--vc:${meta.color}">
    <span class="verdict-label">${esc(meta.label)}</span>
    <span class="verdict-conf">${esc(v.confidence)} confidence</span>
  </div>`;
}

// System change (primitives lens): which primitives the diff touches, how hard
// (composes/extends/adds), and which invariants are in play. `adds` entries are
// the "did the agent invent a new shape?" alarm and render loudest.
function systemChangeCard(r: Report): string {
  const sc = r.systemChange;
  if (!sc) return "";
  const overall = CLASSIFICATION[(sc.overall ?? "composes") as Classification] ?? CLASSIFICATION.composes;
  const prims = Array.isArray(sc.primitives) ? sc.primitives : [];
  const added = Array.isArray(sc.added) ? sc.added : [];

  const pill = (c: Classification) => {
    const k = CLASSIFICATION[c] ?? CLASSIFICATION.composes;
    return `<span class="sc-pill" style="--pc:${k.color}">${k.label}</span>`;
  };

  const order: Classification[] = ["adds", "extends", "composes"];
  const rows = [...prims]
    .sort((a, b) => order.indexOf(a.classification) - order.indexOf(b.classification))
    .map((p) => {
      const inv = (p.invariantsTouched ?? [])
        .map((i) => `<li class="sc-inv">⚠ ${esc(i)}</li>`)
        .join("");
      return `<div class="sc-row" style="--pc:${(CLASSIFICATION[p.classification] ?? CLASSIFICATION.composes).color}">
        <div class="sc-head">${pill(p.classification)}<span class="sc-name">${esc(p.name || p.id)}</span>
          ${p.area ? `<span class="comp-tag">${esc(p.area)}</span>` : ""}
          ${p.files?.length ? `<code class="sc-files">${p.files.map(esc).join(" · ")}</code>` : ""}</div>
        ${p.note ? `<div class="sc-note">${esc(p.note)}</div>` : ""}
        ${inv ? `<ul class="sc-invs">${inv}</ul>` : ""}
      </div>`;
    })
    .join("");

  const addedBlock = added.length
    ? `<div class="sc-added"><div class="sc-added-head">⚠ New primitives not in the map</div>
       ${added
         .map(
           (a) => `<div class="sc-row" style="--pc:${CLASSIFICATION.adds.color}">
             <div class="sc-head">${pill("adds")}<span class="sc-name">${esc(a.name)}</span>
             ${a.files?.length ? `<code class="sc-files">${a.files.map(esc).join(" · ")}</code>` : ""}</div>
             ${a.note ? `<div class="sc-note">${esc(a.note)}</div>` : ""}</div>`
         )
         .join("")}</div>`
    : "";

  const mapBadge =
    sc.mapUpdated === undefined
      ? ""
      : sc.mapUpdated
        ? `<span class="chip chip-ok">map updated in this PR</span>`
        : prims.some((p) => p.classification !== "composes") || added.length
          ? `<span class="chip sc-stale">map NOT updated</span>`
          : "";

  const body =
    prims.length || added.length
      ? `${rows}${addedBlock}`
      : `<div class="empty">No mapped primitive touched — the change composes entirely outside the map.</div>`;

  return `<section class="card"><h2>System change
    <span class="sc-pill sc-overall" style="--pc:${overall.color}">${overall.label}</span>
    ${mapBadge}
    ${sc.mapPath ? `<span class="head-total">${esc(sc.mapPath)}</span>` : ""}</h2>
    ${body}</section>`;
}

function findingCard(m: Meta, f: Finding): string {
  const s = SEV[f.severity] ?? SEV.medium;
  const badges = [
    `<span class="chip" style="--cc:${s.color}">${s.dot} ${s.label}</span>`,
    `<span class="chip chip-lens">${esc(f.lens)}</span>`,
    f.category ? `<span class="chip chip-cat">${esc(f.category)}</span>` : "",
    f.verified ? `<span class="chip chip-ok">✓ verified</span>` : "",
    // origin chip only when the --holistic comparison ran (source absent otherwise)
    f.source && f.source !== "lenses" ? `<span class="chip chip-src">${esc(f.source)}</span>` : "",
    f.locations?.length ? `<span class="chip chip-group">×${f.locations.length} occurrences</span>` : "",
    // linked chip when /review-issues filed this finding as a review-debt issue
    f.trackedIssue && safeUrl(f.trackedIssue)
      ? `<a class="chip chip-tracked" href="${esc(safeUrl(f.trackedIssue))}" target="_blank" rel="noopener">tracked ↗</a>`
      : "",
  ].join("");
  // A grouped finding (arbiter swarm-collapse) lists every occurrence, each with
  // its optional one-line per-site note (the site-specific gap/fix).
  const locations = f.locations?.length
    ? `<ul class="loc-list">${f.locations
        .map(
          (l) =>
            `<li>${fileRef(m, l.file, l.line)}${
              l.note ? `<span class="loc-note">${renderInline(l.note, m)}</span>` : ""
            }</li>`
        )
        .join("")}</ul>`
    : "";
  // id anchor so external links (e.g. publish.ts's PR comments) can deep-link a finding
  return `<article class="finding" id="f-${esc(f.id)}" style="--sc:${s.color}">
    <header class="finding-head">
      <div class="chips">${badges}</div>
      ${f.file ? `<div class="finding-ref">${fileRef(m, f.file, f.line)}</div>` : ""}
    </header>
    <h4 class="finding-title">${esc(f.title)}</h4>
    ${f.rule ? `<div class="finding-rule"><span class="rule-tag">Rule</span>${renderInline(f.rule, m)}</div>` : ""}${
      f.regradeNote
        ? `<div class="finding-regrade"><span class="regrade-tag">Regraded</span>${renderInline(f.regradeNote, m)}</div>`
        : ""
    }${locations}
    ${f.evidence ? `<div class="finding-evidence md">${renderRich(f.evidence, m)}</div>` : ""}
    ${
      f.suggestion
        ? `<div class="finding-fix"><div class="fix-tag">Fix</div><div class="md">${renderRich(f.suggestion, m)}</div></div>`
        : ""
    }${
      f.verifiable
        ? `
    <div class="pf-verify"><span class="pf-verify-tag">verify</span><code>${esc(f.verifiable)}</code></div>`
        : ""
    }
  </article>`;
}

// Group findings by severity (high → low) and render each non-empty tier as a
// list of finding cards. Shared by the Findings and Conventions sections, which
// differ only in their heading and empty-state copy.
function severityGroups(m: Meta, findings: Finding[]): string {
  return SEV_ORDER.map((sev) => {
    const group = findings.filter((f) => f.severity === sev);
    if (!group.length) return "";
    return `<div class="sev-group">
      <h3 class="sev-head" style="--sc:${SEV[sev].color}">${SEV[sev].dot} ${SEV[sev].label}
        <span class="count">${group.length}</span></h3>
      ${group.map((f) => findingCard(m, f)).join("")}
    </div>`;
  }).join("");
}

function findingsSection(m: Meta, findings: Finding[]): string {
  // only findings that belong in this section (first-five, intent, seams, …);
  // folded findings render in the collapsed "More findings" section instead
  const core = findings.filter((f) => sectionOf(f) === "findings" && !f.folded);
  const body = !core.length
    ? `<p class="empty">✅ No code-quality findings — no bugs, unsafe inputs, or mismatched intent surfaced.</p>`
    : severityGroups(m, core);
  return `<section id="findings" class="card"><h2>Findings ${countBadge(core.length)}</h2>${body}</section>`;
}

const SCORE: Record<ScoreStatus, { g: string; c: string; label: string }> = {
  pass: { g: "✓", c: "#5fd39a", label: "conforms" },
  warn: { g: "!", c: "#f2c063", label: "minor issues" },
  fail: { g: "✕", c: "#ff8589", label: "violations" },
  na: { g: "–", c: "#8b8d98", label: "not applicable" },
};

// Per-area conventions / tech-stack conformance grid. Only rendered when the
// conventions lens supplied a scorecard.
function scorecardCard(r: Report): string {
  const items = Array.isArray(r.scorecard) ? r.scorecard : [];
  if (!items.length) return "";
  const cells = items
    .map((it) => {
      const s = SCORE[it.status] ?? SCORE.na;
      return `<div class="score-cell" style="--sq:${s.c}">
        <div class="score-head"><span class="score-mark">${s.g}</span>
          <span class="score-area">${esc(it.area)}</span></div>
        <div class="score-note">${renderInline(it.note, r.meta)}</div>
      </div>`;
    })
    .join("");
  return `<section class="card"><h2>Conventions &amp; stack conformance
    <span class="section-tag">CRAFT</span></h2>
    <div class="scorecard">${cells}</div></section>`;
}

function conventionsSection(m: Meta, findings: Finding[]): string {
  const conv = findings.filter((f) => sectionOf(f) === "conventions" && !f.folded);
  const head = `<h2>Conventions ${countBadge(conv.length)} <span class="section-tag">CRAFT</span></h2>`;
  const body = !conv.length
    ? `<p class="empty">No convention or craft issues — the change matches the
      repository's own structure, readability, DRY, naming, and tech-stack rules
      (or no convention docs were found to check against).</p>`
    : severityGroups(m, conv);
  return `<section id="conventions" class="card">${head}${body}</section>`;
}

function dependencySection(m: Meta, findings: Finding[]): string {
  const deps = findings.filter((f) => f.lens === "warm" && !f.folded);
  const head = `<h2>Dependencies ${countBadge(deps.length)} <span class="section-tag">WARM</span></h2>`;
  if (!deps.length) {
    return `<section id="deps" class="card">${head}
      <p class="empty">No dependency manifest changed in this PR — the WARM audit
      (<b>W</b>orth&nbsp;it · <b>A</b>live · <b>R</b>ight-sized · <b>M</b>aintained&nbsp;securely)
      was skipped.</p></section>`;
  }
  const mk = (x?: Mark) => {
    const d = MARK[x ?? "unknown"];
    return `<span class="mark" style="--mc:${d.c}">${d.g}</span>`;
  };
  const rows = deps
    .map(
      (d) => `<tr>
      <td class="dep-name">${esc(d.title)}<span class="dep-eco">${esc(d.ecosystem ?? "")} · ${esc(
        d.changeType ?? ""
      )}</span></td>
      <td>${mk(d.warm?.worth)}</td><td>${mk(d.warm?.alive)}</td>
      <td>${mk(d.warm?.rightSized)}</td><td>${mk(d.warm?.secure)}</td>
      <td class="dep-verdict">${esc(d.packageVerdict ?? "")}</td>
      <td class="dep-note md">${renderInline(d.evidence, m)}${
        d.suggestion ? `<div class="dep-suggestion">${renderRich(d.suggestion, m)}</div>` : ""
      }</td>
    </tr>`
    )
    .join("");
  return `<section id="deps" class="card">${head}
    <table class="deptable">
      <thead><tr><th>Package</th><th title="Worth it">W</th><th title="Alive">A</th>
        <th title="Right-sized">R</th><th title="Maintained securely">M</th>
        <th>Verdict</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody></table></section>`;
}

function zombiesSection(m: Meta, findings: Finding[], groups: any[]): string {
  const zf = findings.filter((f) => f.lens === "zombies" && !f.folded);
  const head = `<h2>Test gaps ${countBadge(zf.length)} <span class="section-tag">ZOMBIES</span></h2>`;
  if (!zf.length) {
    return `<section id="tests" class="card">${head}
      <p class="empty">No high-value test gaps found — the changed code's Zero / One /
      Many / Boundaries / Interface / Exceptions / Simple cases look adequately covered.</p></section>`;
  }
  const byArea = new Map<string, Finding[]>();
  for (const f of zf) {
    const a = f.featureArea || "General";
    if (!byArea.has(a)) byArea.set(a, []);
    byArea.get(a)!.push(f);
  }
  const blocks = [...byArea.entries()]
    .map(([area, items]) => {
      items.sort((a, b) => ZLET.indexOf((a.zombiesLetter || "").toUpperCase()) - ZLET.indexOf((b.zombiesLetter || "").toUpperCase()));
      return `<div class="test-group"><h3>${esc(area)}</h3>
        ${items
          .map(
            (f) => `<div class="test-item">
          <span class="zbadge" title="${zName((f.zombiesLetter || "").toUpperCase())}">${esc(
              (f.zombiesLetter || "?").toUpperCase()
            )}</span>
          <div class="test-body">
            <div class="test-title">${esc(f.title)}${
              f.partial ? ` <span class="partial-tag">partial</span>` : ""
            }</div>
            <div class="test-fix md">${renderRich(f.suggestion, m)}</div>
            ${f.file ? `<div class="test-ref">${fileRef(m, f.file, f.line)}</div>` : ""}
          </div></div>`
          )
          .join("")}
      </div>`;
    })
    .join("");
  return `<section id="tests" class="card">${head}
    ${zombiesKey()}
    ${zombiesMatrix(findings, groups)}
    ${blocks}</section>`;
}

function preflightSection(m: Meta, findings: Finding[]): string {
  const pf = findings.filter((f) => f.lens === "preflight" && !f.folded);
  const head = `<h2>Preflight checklist ${countBadge(pf.length)} <span class="section-tag">before merge</span></h2>`;
  if (!pf.length) {
    return `<section id="preflight" class="card">${head}
      <p class="empty">No deploy-time actions detected — no migrations, new config/secrets,
      infra, or post-deploy watch items implied by this diff.</p></section>`;
  }
  const byCat = new Map<string, Finding[]>();
  for (const f of pf) {
    if (!byCat.has(f.category)) byCat.set(f.category, []);
    byCat.get(f.category)!.push(f);
  }
  const blocks = [...byCat.entries()]
    .map(
      ([cat, items]) => `<div class="pf-group"><h3>${esc(cat)}</h3>
      <ul class="checklist">${items
        .map(
          (f, i) => `<li>
        <input type="checkbox" id="pf-${esc(cat)}-${i}">
        <div class="pf-main">
          <label for="pf-${esc(cat)}-${i}">
            <span class="pf-conf pf-${esc(f.confidence ?? "medium")}">${esc(f.confidence ?? "")}</span>
            <span class="pf-title">${esc(f.title)}</span>
            ${f.file ? `<span class="pf-ref">${fileRef(m, f.file, f.line)}</span>` : ""}
          </label>
          ${f.suggestion ? `<div class="pf-note md">${renderRich(f.suggestion, m)}</div>` : ""}${
            f.verifiable
              ? `<div class="pf-verify"><span class="pf-verify-tag">verify</span><code>${esc(f.verifiable)}</code></div>`
              : ""
          }
        </div></li>`
        )
        .join("")}</ul></div>`
    )
    .join("");
  return `<section id="preflight" class="card">${head}
    ${blocks}</section>`;
}

function triageSection(m: Meta, triage: Report["triage"]): string {
  if (!triage.groups?.length) return "";
  const groups = triage.groups
    .map(
      (g) => `<details class="tri-group" open>
      <summary><span class="tri-risk" style="background:${RISK[g.risk] ?? "#8b8d98"}">${esc(
        g.risk
      )}</span> <span class="tri-name">${esc(g.name)}</span>
        <span class="tri-count">${g.files.length}</span></summary>
      ${g.reason ? `<p class="tri-reason">${renderInline(g.reason, m)}</p>` : ""}
      <ul class="tri-files">${g.files
        .map(
          (f: any) =>
            `<li><span class="status status-${esc(f.status)}">${esc(f.status)}</span> ${fileRef(
              m,
              f.path,
              0
            )}</li>`
        )
        .join("")}</ul></details>`
    )
    .join("");
  const skipped = triage.skipped?.length
    ? `<details class="tri-group"><summary><span class="tri-risk" style="background:#3a3d49">skip</span>
        <span class="tri-name">Auto-generated</span><span class="tri-count">${triage.skipped.length}</span></summary>
        <ul class="tri-files">${triage.skipped.map((s) => `<li><code>${esc(s)}</code></li>`).join("")}</ul></details>`
    : "";
  return `<section class="card"><h2>Triage map</h2>${groups}${skipped}</section>`;
}

const ALL_LENSES = ["triage", "first-five", "conventions", "intent", "warm", "zombies", "preflight"] as const;

// A visible strip of which lenses ran vs. were skipped. Uses meta.lenses when the
// orchestrator provides it; otherwise infers "ran" from findings present.
// Conditional passes (seams in sharded mode, arbiter, holistic) only get a chip when
// meta.lenses names them — the default small-PR strip is unchanged.
function lensesStrip(r: Report): string {
  const provided: Array<{ name: string; status: string; note?: string }> = Array.isArray(r.meta?.lenses)
    ? r.meta.lenses
    : [];
  const byName = new Map(provided.map((l) => [l.name, l]));
  const seen = new Set(r.findings.map((f) => f.lens));
  const chip = (name: string, ran: boolean, note?: string) =>
    `<span class="lens-chip ${ran ? "lens-on" : "lens-off"}" title="${ran ? "ran" : "skipped"}${note ? ` — ${esc(note)}` : ""}">
      <span class="lens-dot"></span>${esc(name)}</span>`;
  const chips = ALL_LENSES.map((name) => {
    const info = byName.get(name);
    const ran = info ? info.status !== "skipped" : name === "triage" || seen.has(name);
    return chip(name, ran, info?.note);
  }).join("");
  const extras = provided
    .filter((l) => !(ALL_LENSES as readonly string[]).includes(l.name))
    .map((l) => chip(l.name, l.status !== "skipped", l.note))
    .join("");
  return `<div class="lenses-strip"><span class="lenses-lbl">Lenses</span>${chips}${extras}</div>`;
}

function limitationsCard(r: Report): string {
  // When Phase 2 sharded, say so here even if the orchestrator wrote no limitations —
  // the reader should always learn the review ran per-area rather than whole-diff.
  const shardNote = r.meta?.sharding?.sharded
    ? `Sharded review: lenses ran per feature area (threshold ${esc(
        r.meta.sharding.threshold ?? "?"
      )} changed lines)${
        r.meta.sharding.areas?.length ? ` — areas: ${esc(r.meta.sharding.areas.join(", "))}` : ""
      }; the seams lens covered cross-area contracts.`
    : "";
  const items = [...(shardNote ? [shardNote] : []), ...(r.limitations ?? [])];
  if (!items.length) return "";
  return `<section class="card limits-card"><h2>Scope &amp; limitations</h2>
    <ul class="limits">${items.map((l) => `<li>${renderInline(l, r.meta)}</li>`).join("")}</ul></section>`;
}

// Findings the arbiter marked `folded: true` (beyond the report budget) — shown in
// a collapsed section for completeness rather than being omitted from the report.
function foldedSection(m: Meta, findings: Finding[]): string {
  const folded = findings.filter((f) => f.folded);
  if (!folded.length) return "";
  return `<section id="more-findings" class="card">
    <details class="fold-details">
      <summary>More findings ${countBadge(folded.length)}
        <span class="section-tag">beyond report budget</span>
        <span class="fold-hint">folded by the severity arbiter — click to expand</span></summary>
      ${severityGroups(m, folded)}
    </details></section>`;
}

// Small comparison card rendered only when meta.holistic exists (--holistic runs):
// how much the lens decomposition and a single full-context pass overlapped, and
// which findings only the holistic pass caught (the lens-gap indicators).
function holisticCard(r: Report): string {
  const h = r.meta?.holistic;
  if (!h) return "";
  const stat = (n: number, lbl: string) =>
    `<div class="holi-stat"><div class="holi-num">${esc(n)}</div><div class="holi-lbl">${esc(lbl)}</div></div>`;
  const only = r.findings.filter((f) => f.source === "holistic");
  const list = only.length
    ? `<div class="holi-only"><div class="holi-only-head">Holistic-only findings (lens-decomposition gaps)</div>
      <ul class="holi-list">${only
        .map((f) => `<li><a href="#f-${esc(f.id)}">${esc(f.title)}</a></li>`)
        .join("")}</ul></div>`
    : `<p class="empty">No holistic-only findings — the lens decomposition covered everything the full-context pass caught.</p>`;
  return `<section class="card"><h2>Holistic comparison <span class="section-tag">eval</span></h2>
    <div class="holi-stats">${stat(h.lensesOnly, "lenses only")}${stat(h.both, "both")}${stat(
      h.holisticOnly,
      "holistic only"
    )}</div>${list}</section>`;
}

// ---------- page ----------
function page(r: Report): string {
  const m = r.meta;
  // Donut spans EVERY finding (all lenses) so its center total equals the sum of
  // the by-section breakdown — no more "7 in the wheel but 1 in Findings".
  const counts = SEV_ORDER.reduce((acc, s) => {
    acc[s] = r.findings.filter((f) => f.severity === s).length;
    return acc;
  }, {} as Record<Sev, number>);

  const subtitle =
    m.mode === "pr" && m.prNumber
      ? `PR #${esc(m.prNumber)}`
      : `${esc(m.base)} → ${esc(m.head)}`;
  const shaShort = (m.headSha || "").slice(0, 7);
  const prUrl = safeUrl(m.url);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review — ${esc(m.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* "Midnight" visual language — shared with the toolkit guide
     (skills/code-reviews/review-toolkit.html) so the toolkit feels like one product. */
  :root{
    --bg:#08090c; --panel:#101116; --panel2:#16171e; --border:#24262f; --border2:#31343f;
    --text:#e2e3e9; --head:#f7f8fa; --muted:#9a9daa; --accent:#828fff; --accent2:#5e6ad2;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;
    --sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);
    line-height:1.55;font-size:15px;-webkit-font-smoothing:antialiased}
  body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
    background:radial-gradient(60% 40% at 50% -5%,rgba(94,106,210,.16),transparent 70%),var(--bg)}
  a{color:inherit}
  .wrap{max-width:960px;margin:0 auto;padding:32px 24px 80px}
  .ref{font-family:var(--mono);font-size:12.5px;color:#7ec2ff;text-decoration:none;white-space:nowrap}
  .ref:hover{text-decoration:underline}
  code{font-family:var(--mono);font-size:12.5px;color:var(--muted)}
  .empty{color:var(--muted);font-style:italic;padding:8px 0}

  /* header */
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;
    padding-bottom:24px;border-bottom:1px solid var(--border);margin-bottom:28px}
  .top h1{margin:0 0 6px;font-size:22px;letter-spacing:-.02em;color:var(--head)}
  .top .sub{color:var(--muted);font-size:13px}
  .top .sub a{color:#7ec2ff;text-decoration:none}
  .meta-row{display:flex;gap:16px;margin-top:12px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
  .meta-row b{color:var(--text);font-weight:600}
  .diffstat .add{color:#5fd39a}
  .diffstat .del{color:#ff8589}
  .verdict{display:flex;flex-direction:column;align-items:flex-end;gap:4px;
    padding:12px 18px;border-radius:12px;border:1px solid var(--vc);
    background:color-mix(in srgb,var(--vc) 12%,transparent);white-space:nowrap}
  .verdict-label{font-weight:700;font-size:16px;color:var(--vc)}
  .verdict-conf{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}

  /* dashboard */
  .dash{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
  @media(max-width:720px){.dash{grid-template-columns:1fr}.top{flex-direction:column}}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:12px;
    padding:20px 22px;margin-bottom:16px;transition:border-color .15s}
  .card:hover{border-color:var(--border2)}
  .card h2{margin:0 0 16px;font-size:15px;letter-spacing:.01em;display:flex;align-items:center;
    gap:10px;color:var(--head)}
  .section-tag{font-size:11px;font-weight:500;color:var(--muted);background:var(--panel2);
    padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em}
  .summary-card{grid-column:1/-1}
  .summary-card p{margin:0;color:var(--text)}

  .sev-split{display:flex;align-items:center;gap:22px}
  .donut{width:130px;height:130px;flex:none}
  .donut-num{fill:var(--text);font-size:26px;font-weight:700;text-anchor:middle;font-family:var(--sans)}
  .donut-lbl{fill:var(--muted);font-size:10px;text-anchor:middle;text-transform:uppercase;letter-spacing:.08em}
  .legend{list-style:none;margin:0;padding:0;flex:1;display:grid;gap:7px}
  .legend li{display:flex;align-items:center;gap:9px;font-size:13px}
  .swatch{width:11px;height:11px;border-radius:3px;flex:none}
  .legend-lbl{flex:1;color:var(--muted)}
  .legend-num{font-variant-numeric:tabular-nums;font-weight:600}

  .heatmap{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
  .heat-cell{border-radius:0 10px 10px 0;padding:12px;border:1px solid var(--border);
    border-left:4px solid var(--risk);background:var(--panel2)}
  .heat-risk{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--risk);font-weight:700}
  .heat-name{font-weight:600;margin:3px 0;font-size:14px}
  .heat-files{color:var(--muted);font-size:12px}

  /* findings */
  .sev-group{margin-bottom:22px}
  .sev-head{font-size:14px;margin:0 0 12px;display:flex;align-items:center;gap:8px;color:var(--sc)}
  .sev-head .count{background:var(--panel2);color:var(--muted);font-size:12px;
    padding:1px 9px;border-radius:20px;font-weight:600}
  .finding{background:var(--panel);border:1px solid var(--border);border-left:3px solid var(--sc);
    border-radius:0 10px 10px 0;padding:18px 22px 20px;margin-bottom:12px}
  .finding-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
  .chips{display:flex;gap:6px;flex-wrap:wrap}
  .chip{font-size:11px;padding:2px 9px;border-radius:20px;background:var(--panel2);
    color:var(--muted);white-space:nowrap;border:1px solid var(--border)}
  .chip[style*="--cc"]{color:var(--cc);border-color:color-mix(in srgb,var(--cc) 40%,transparent)}
  .chip-ok{color:#5fd39a;border-color:#2f5c45}
  .finding-title{margin:13px 0 12px;font-size:16.5px;font-weight:700;line-height:1.35;
    letter-spacing:-.01em;color:var(--head)}
  .finding-evidence{margin:0 0 14px}
  .finding-fix{background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:13px 15px;margin-top:14px}
  .fix-tag{color:var(--accent);font-weight:700;font-size:11px;text-transform:uppercase;
    letter-spacing:.05em;margin-bottom:8px}
  /* cited rule (conventions lens) */
  .finding-rule{display:flex;align-items:baseline;gap:8px;margin:0 0 12px;font-size:12.5px;color:var(--muted)}
  .finding-rule .rule-tag{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:#f7d494;background:color-mix(in srgb,#f2c063 14%,var(--panel2));
    border:1px solid color-mix(in srgb,#f2c063 32%,var(--border));border-radius:20px;padding:1px 8px}
  .finding-rule code{color:#bcc3ff}
  /* arbiter regrade note */
  .finding-regrade{display:flex;align-items:baseline;gap:8px;margin:0 0 12px;font-size:12.5px;color:var(--muted)}
  .finding-regrade .regrade-tag{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:#a5d3ff;background:color-mix(in srgb,#7ec2ff 14%,var(--panel2));
    border:1px solid color-mix(in srgb,#7ec2ff 32%,var(--border));border-radius:20px;padding:1px 8px}
  /* grouped finding (arbiter swarm-collapse): every occurrence listed */
  .loc-list{list-style:none;margin:0 0 12px;padding:9px 13px;display:grid;gap:4px;
    background:var(--panel2);border:1px solid var(--border);border-radius:8px}
  .loc-list li{font-size:12.5px}
  .loc-list .loc-note{color:var(--muted);margin-left:8px}
  .chip-group{color:#bcc3ff;border-color:color-mix(in srgb,var(--accent) 40%,transparent)}
  .chip-src{color:#a5d3ff;border-color:color-mix(in srgb,#7ec2ff 40%,transparent)}
  a.chip-tracked{color:#8ce8b8;border-color:color-mix(in srgb,#5fd39a 40%,transparent);text-decoration:none}
  a.chip-tracked:hover{border-color:#5fd39a}
  /* folded "More findings" section */
  .fold-details summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;
    font-size:15px;font-weight:700;letter-spacing:.01em}
  .fold-details summary::-webkit-details-marker{display:none}
  .fold-details summary::before{content:"▸";color:var(--muted);font-size:12px;transition:transform .12s}
  .fold-details[open] summary::before{transform:rotate(90deg)}
  .fold-details[open] summary{margin-bottom:16px}
  .fold-hint{font-size:11.5px;font-weight:400;color:var(--muted)}
  /* holistic comparison card */
  .holi-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  .holi-stat{border:1px solid var(--border);border-radius:10px;background:var(--panel2);
    padding:10px 12px;text-align:center}
  .holi-num{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
  .holi-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  .holi-only-head{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);
    font-weight:700;margin-bottom:7px}
  .holi-list{list-style:none;margin:0;padding:0;display:grid;gap:5px}
  .holi-list li{font-size:13px}
  .holi-list a{color:#7ec2ff;text-decoration:none}
  .holi-list a:hover{text-decoration:underline}

  /* conventions / stack scorecard */
  .scorecard{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
  .score-cell{border-radius:0 10px 10px 0;padding:11px 13px;border:1px solid var(--border);
    border-left:4px solid var(--sq);background:var(--panel2)}
  .score-head{display:flex;align-items:center;gap:8px;margin-bottom:3px}
  .score-mark{width:20px;height:20px;flex:none;border-radius:50%;display:inline-flex;align-items:center;
    justify-content:center;font-weight:700;font-size:12px;color:var(--sq);
    background:color-mix(in srgb,var(--sq) 15%,transparent)}
  .score-area{font-weight:600;font-size:14px}
  .score-note{color:var(--muted);font-size:12px;line-height:1.45}
  .score-note code{font-size:11.5px}

  /* dependency table */
  .deptable,.zmatrix{width:100%;border-collapse:collapse;font-size:13px}
  .deptable th,.deptable td{padding:9px 10px;text-align:left;border-bottom:1px solid var(--border);vertical-align:top}
  .deptable th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .deptable td:nth-child(2),.deptable td:nth-child(3),.deptable td:nth-child(4),.deptable td:nth-child(5),
  .deptable th:nth-child(2),.deptable th:nth-child(3),.deptable th:nth-child(4),.deptable th:nth-child(5){text-align:center;width:34px}
  .dep-name{font-weight:600}
  .dep-eco{display:block;font-weight:400;color:var(--muted);font-size:11px;margin-top:2px}
  .mark{display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;
    border-radius:50%;font-weight:700;font-size:12px;color:var(--mc);
    background:color-mix(in srgb,var(--mc) 15%,transparent)}
  .dep-verdict{text-transform:capitalize;font-weight:600}
  .dep-note{color:var(--muted);font-size:12.5px}
  .dep-suggestion{margin-top:5px;color:var(--text)}
  .dep-note .dep-suggestion p{margin:0}
  .dep-note .dep-suggestion .md-pre{margin:6px 0 0}

  /* zombies matrix */
  .zmatrix{margin-bottom:18px}
  .zmatrix th,.zmatrix td{border:1px solid var(--border);padding:7px;text-align:center}
  .zmatrix th:first-child,.zarea{text-align:left;font-weight:600}
  .zarea{color:var(--text)}
  .zc{color:var(--muted)}
  .zc-on{background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--text);font-weight:700}
  .zc-partial{background:color-mix(in srgb,#f2c063 22%,transparent)}
  .matrix-key{font-size:12px;color:var(--muted);margin:0 0 4px}
  .zc-partial-key{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;
    background:color-mix(in srgb,#f2c063 40%,transparent)}
  .test-group{margin-top:16px}
  .test-group h3,.pf-group h3,.tri-group{font-size:13px}
  .test-group h3{color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px}
  .test-item{display:flex;gap:12px;padding:9px 0;border-top:1px solid var(--border)}
  .zbadge{flex:none;width:26px;height:26px;border-radius:7px;background:var(--panel2);
    display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--accent);font-family:var(--mono)}
  .test-title{font-weight:600;font-size:14px}
  .partial-tag{font-size:10px;background:#3f351c;color:#f2c063;padding:1px 7px;border-radius:20px;margin-left:6px}
  .test-fix{color:var(--muted);font-size:13px;margin:2px 0}
  .test-fix.md p{margin:0}
  .test-fix.md .md-pre{margin:6px 0 0}
  .test-ref{margin-top:2px}

  /* preflight */
  .pf-group{margin-bottom:14px}
  .pf-group h3{color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px}
  .checklist{list-style:none;margin:0;padding:0}
  .checklist li{display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--border);align-items:flex-start}
  .checklist input{margin-top:3px;accent-color:var(--accent);width:16px;height:16px;flex:none}
  .pf-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
  .checklist label{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;cursor:pointer}
  .checklist input:checked + .pf-main .pf-title{text-decoration:line-through;color:var(--muted)}
  .pf-conf{font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:1px 7px;border-radius:20px;font-weight:700}
  .pf-high{background:#3f2026;color:#ffb0b3}.pf-medium{background:#3f351c;color:#f2c063}.pf-low{background:#1e3350;color:#7ec2ff}
  .pf-title{font-weight:600;font-size:14px}
  .pf-note{color:var(--muted);font-size:12.5px}
  .pf-verify{display:flex;align-items:baseline;gap:8px;margin-top:4px}
  .pf-verify-tag{flex:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:#8ce8b8;background:color-mix(in srgb,#5fd39a 14%,var(--panel2));
    border:1px solid color-mix(in srgb,#5fd39a 32%,var(--border));border-radius:20px;padding:1px 8px}
  .pf-verify code{font-size:11.5px;color:#d5d7e0}
  .pf-note.md p{margin:0}
  .pf-note.md .md-pre{margin:6px 0 0}

  /* system change (primitives lens) */
  .sc-pill{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:#08090c;background:var(--pc);border-radius:20px;padding:2px 9px;flex:none}
  .sc-overall{font-size:11px}
  .sc-stale{color:#ffb0b3;border-color:color-mix(in srgb,#ff8589 40%,transparent)}
  .sc-row{border:1px solid var(--border);border-left:4px solid var(--pc);border-radius:0 10px 10px 0;
    background:var(--panel2);padding:11px 14px;margin-bottom:8px}
  .sc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .sc-name{font-weight:600;font-size:14px}
  .sc-files{font-family:var(--mono);font-size:11.5px;color:var(--muted)}
  .sc-note{color:var(--muted);font-size:12.5px;margin-top:4px}
  .sc-invs{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:3px}
  .sc-inv{font-size:12.5px;color:#f7d494}
  .sc-added{margin-top:12px;padding-top:10px;border-top:1px dashed var(--border)}
  .sc-added-head{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:#ffb0b3;margin-bottom:8px}

  /* triage */
  .tri-group{background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:4px 14px;margin-bottom:8px}
  .tri-group summary{cursor:pointer;display:flex;align-items:center;gap:10px;padding:8px 0;list-style:none}
  .tri-group summary::-webkit-details-marker{display:none}
  .tri-risk{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:20px;
    color:#08090c;font-weight:700}
  .tri-name{font-weight:600;flex:1}
  .tri-count{color:var(--muted);font-size:12px}
  .tri-reason{color:var(--muted);font-size:13px;margin:2px 0 8px}
  .tri-files{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:5px}
  .tri-files li{display:flex;gap:9px;align-items:center;font-size:13px}
  .status{font-size:10px;text-transform:uppercase;letter-spacing:.04em;padding:1px 7px;border-radius:5px;
    font-weight:700;flex:none}
  .status-added{background:#17352a;color:#5fd39a}.status-modified{background:#3a301a;color:#f2c063}
  .status-deleted{background:#3a1c1e;color:#ffa6a9}

  /* section heading badges */
  .head-count{font-size:12px;font-weight:600;color:var(--muted);background:var(--panel2);
    border:1px solid var(--border);border-radius:20px;padding:1px 10px;min-width:24px;text-align:center}
  .head-count[data-zero]{opacity:.5}
  .head-total{font-size:11px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}

  /* composition (by-section) */
  .composition{display:flex;flex-direction:column;gap:6px}
  .comp-row{display:flex;align-items:center;gap:14px;padding:10px 12px;border-radius:10px;
    border:1px solid var(--border);background:var(--panel2);text-decoration:none;color:inherit;transition:border-color .12s}
  .comp-row:hover{border-color:var(--accent)}
  .comp-empty{opacity:.55}
  .comp-count{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;min-width:26px;text-align:center}
  .comp-body{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0}
  .comp-name{font-weight:600;font-size:14px}
  .comp-tag{font-size:9.5px;font-weight:600;color:var(--muted);background:var(--panel);
    border:1px solid var(--border);border-radius:20px;padding:1px 6px;text-transform:uppercase;letter-spacing:.05em;margin-left:4px}
  .comp-desc{color:var(--muted);font-size:12px}
  .comp-sevs{display:flex;gap:4px;align-items:center}
  .mini-sev{font-size:11px;font-weight:700;color:#08090c;background:var(--c);border-radius:6px;
    min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;
    font-variant-numeric:tabular-nums}
  .comp-none{font-size:11px;color:var(--muted);font-style:italic}

  /* summary body + lenses strip */
  .summary-body p:first-child{margin-top:0}
  .summary-body p:last-child{margin-bottom:0}
  .lenses-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;
    padding-top:14px;border-top:1px solid var(--border)}
  .lenses-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}
  .lens-chip{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;padding:2px 9px;border-radius:20px;
    border:1px solid var(--border);background:var(--panel2)}
  .lens-dot{width:7px;height:7px;border-radius:50%;flex:none}
  .lens-on{color:var(--text)}.lens-on .lens-dot{background:#5fd39a}
  .lens-off{color:var(--muted)}.lens-off .lens-dot{background:#3a3d49}
  .lens-off{text-decoration:line-through;text-decoration-color:#3a3d49}

  /* markdown-rendered content — tuned to read like a short article */
  .md{font-size:14px;line-height:1.65;color:var(--text)}
  .md > :first-child{margin-top:0}
  .md > :last-child{margin-bottom:0}
  .md p{margin:0 0 13px}
  /* subheadings: clear hierarchy + breathing room so sections are scannable */
  .md .md-h{font-weight:700;letter-spacing:.01em;color:var(--text)}
  .md .md-h1{font-size:15.5px;margin:22px 0 9px;padding-bottom:6px;border-bottom:1px solid var(--border)}
  .md .md-h2{font-size:13.5px;margin:20px 0 8px;display:flex;align-items:center;gap:8px}
  .md .md-h2::before{content:"";width:3px;height:14px;border-radius:2px;background:var(--accent);flex:none}
  .md .md-h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:16px 0 6px}
  .md .md-h:first-child{margin-top:0}
  .md .md-list{margin:0 0 13px;padding-left:22px}
  .md .md-list li{margin:4px 0}
  .md strong{color:#fff;font-weight:700}
  .md em{color:var(--text);font-style:italic}
  .md a{color:#7ec2ff;text-decoration:none}.md a:hover{text-decoration:underline}
  /* inline code — tinted lavender so it reads as "code" */
  .md code.md-code{font-family:var(--mono);font-size:12px;font-weight:600;color:#bcc3ff;
    background:color-mix(in srgb,var(--accent) 15%,var(--panel2));
    border:1px solid color-mix(in srgb,var(--accent) 32%,var(--border));padding:1px 6px;border-radius:5px;white-space:nowrap}
  /* file & file:line references — blue, monospace, with the line number emphasised */
  .md .md-file{font-family:var(--mono);font-size:12px;font-weight:600;color:#7ec2ff;
    text-decoration:none;white-space:nowrap;border-bottom:1px dotted color-mix(in srgb,#7ec2ff 45%,transparent)}
  a.md-file:hover{color:#a5d3ff;border-bottom-style:solid}
  .md .md-file .ln{color:#f7d494;font-weight:700}
  .md-pre{background:#0b0c10;border:1px solid var(--border);border-radius:8px;padding:12px 14px;
    overflow-x:auto;margin:0 0 14px;position:relative}
  .md-pre code{background:none;border:none;padding:0;color:#d5d7e0;font-size:12px;line-height:1.55;white-space:pre;font-weight:400}
  .md-pre[data-lang]::before{content:attr(data-lang);position:absolute;top:0;right:0;font-family:var(--mono);
    font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);
    background:var(--panel2);border-bottom-left-radius:8px;border:1px solid var(--border);border-top:none;border-right:none;padding:2px 8px}
  .md-diff code .dl{display:block}
  .md-diff .diff-add{background:color-mix(in srgb,#5fd39a 16%,transparent);color:#a3e8c0}
  .md-diff .diff-del{background:color-mix(in srgb,#ff8589 16%,transparent);color:#ffb0b3}
  .md-diff .diff-hunk{color:#7ec2ff}
  /* markdown tables — a compact visualization primitive */
  .md-table{width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 14px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
  .md-table th,.md-table td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--border);vertical-align:top}
  .md-table th{background:var(--panel2);color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .md-table tr:last-child td{border-bottom:none}
  .md-table td{color:var(--text)}

  /* ---- authored HTML: base tags the agent can hand-write ---- */
  /* Generic tables (no class) get the same treatment as md-tables. */
  .md table{width:100%;border-collapse:collapse;font-size:12.5px;margin:0 0 14px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
  .md table th,.md table td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text)}
  .md table th{background:var(--panel2);color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .md table tr:last-child td{border-bottom:none}
  .md blockquote{margin:0 0 14px;padding:8px 14px;border-left:3px solid var(--accent);
    background:color-mix(in srgb,var(--accent) 8%,var(--panel2));border-radius:0 8px 8px 0;color:var(--muted)}
  .md figure{margin:0 0 16px}
  .md figcaption{font-size:11px;color:var(--muted);margin-top:7px;text-align:center;letter-spacing:.02em}
  .md details{margin:0 0 12px;border:1px solid var(--border);border-radius:8px;background:var(--panel2);padding:0 14px}
  .md summary{cursor:pointer;padding:10px 0;font-weight:600;color:var(--text)}
  .md details[open] summary{border-bottom:1px solid var(--border);margin-bottom:10px}
  .md hr{border:none;border-top:1px solid var(--border);margin:18px 0}
  .md svg{max-width:100%;height:auto;display:block}
  .md kbd{font-family:var(--mono);font-size:11px;background:var(--panel2);border:1px solid var(--border);
    border-bottom-width:2px;border-radius:5px;padding:1px 6px;color:var(--text)}
  .md mark{background:color-mix(in srgb,#f2c063 30%,transparent);color:inherit;border-radius:3px;padding:0 3px}

  /* ---- reusable component classes for author HTML (class="…") ---- */
  /* Callout / admonition boxes: <div class="callout note|warn|danger|ok"> */
  .md .callout{margin:0 0 16px;padding:12px 15px;border:1px solid var(--border);border-left-width:4px;
    border-radius:0 10px 10px 0;background:var(--panel2)}
  .md .callout > :last-child{margin-bottom:0}
  .md .callout .callout-title{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;display:flex;align-items:center;gap:7px}
  .md .callout.note{border-left-color:#7ec2ff}.md .callout.note .callout-title{color:#7ec2ff}
  .md .callout.warn{border-left-color:#f2c063}.md .callout.warn .callout-title{color:#f2c063}
  .md .callout.danger{border-left-color:#ff8589}.md .callout.danger .callout-title{color:#ffb0b3}
  .md .callout.ok{border-left-color:#5fd39a}.md .callout.ok .callout-title{color:#8ce8b8}
  /* Side-by-side / grid layout: <div class="cols"> or class="cols cols-3" */
  .md .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 16px;align-items:start}
  .md .cols-3{grid-template-columns:repeat(3,1fr)}
  .md .cols > *{margin:0}
  @media(max-width:640px){.md .cols,.md .cols-3{grid-template-columns:1fr}}
  /* Bordered panel for grouping content: <div class="panel"> */
  .md .panel{border:1px solid var(--border);border-radius:10px;padding:13px 15px;background:var(--panel2)}
  .md .panel > :last-child{margin-bottom:0}
  /* Inline status badges/pills: <span class="badge red|green|amber|blue"> */
  .md .badge{display:inline-block;font-family:var(--mono);font-size:10.5px;font-weight:700;text-transform:uppercase;
    letter-spacing:.04em;padding:2px 8px;border-radius:999px;border:1px solid var(--border);background:var(--panel2);color:var(--muted);white-space:nowrap}
  .md .badge.red{color:#ffb0b3;border-color:color-mix(in srgb,#ff8589 45%,transparent);background:color-mix(in srgb,#ff8589 14%,transparent)}
  .md .badge.green{color:#8ce8b8;border-color:color-mix(in srgb,#5fd39a 45%,transparent);background:color-mix(in srgb,#5fd39a 14%,transparent)}
  .md .badge.amber{color:#f7d494;border-color:color-mix(in srgb,#f2c063 45%,transparent);background:color-mix(in srgb,#f2c063 14%,transparent)}
  .md .badge.blue{color:#a5d3ff;border-color:color-mix(in srgb,#7ec2ff 45%,transparent);background:color-mix(in srgb,#7ec2ff 14%,transparent)}
  /* Figure/diagram wrapper: <figure class="diagram">…svg…<figcaption>…</figure> */
  .md .diagram{background:var(--panel2);border:1px solid var(--border);border-radius:10px;padding:16px}

  /* zombies legend */
  .zkey{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 16px;margin:0 0 18px;
    padding:14px 16px;background:var(--panel2);border:1px solid var(--border);border-radius:10px}
  .zkey-item{display:flex;gap:10px;align-items:baseline;margin:0}
  .zkey dt{font-family:var(--mono);font-weight:700;color:var(--accent);width:14px;flex:none;font-size:13px}
  .zkey dd{margin:0;font-size:12px;color:var(--muted)}
  .zkey dd b{color:var(--text);font-weight:600}

  /* limitations */
  .limits{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .limits li{position:relative;padding-left:20px;color:var(--muted);font-size:13px;line-height:1.5}
  .limits li::before{content:"›";position:absolute;left:4px;top:-1px;color:var(--accent);font-weight:700}

  footer{margin-top:36px;padding-top:18px;border-top:1px solid var(--border);color:var(--muted);
    font-size:12px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
  .foot-brand{font-weight:700;color:var(--text);background:var(--panel2);border:1px solid var(--border);
    border-radius:6px;padding:2px 8px;letter-spacing:.02em}
</style></head>
<body><div class="wrap">

  <div class="top">
    <div>
      <h1>${esc(m.title)}</h1>
      <div class="sub">${subtitle}${
    prUrl ? ` · <a href="${esc(prUrl)}" target="_blank" rel="noopener">open on GitHub ↗</a>` : ""
  }</div>
      <div class="meta-row">
        ${m.author ? `<span>by <b>${esc(m.author)}</b></span>` : ""}
        ${shaShort ? `<span><b>${esc(shaShort)}</b></span>` : ""}
        <span><b>${esc(m.filesChanged)}</b> files</span>
        <span class="diffstat"><span class="add">+${esc(m.additions)}</span> <span class="del">−${esc(
    m.deletions
  )}</span></span>
      </div>
    </div>
    ${verdictBadge(r.verdict)}
  </div>

  <div class="dash">
    <section class="card summary-card"><h2>Summary</h2><div class="md summary-body">${renderRich(
      r.verdict.summary,
      m
    )}</div>${lensesStrip(r)}</section>
    <section class="card"><h2>By severity <span class="head-total">${r.findings.length} total</span></h2>
      <div class="sev-split">${donut(counts)}${severityLegend(counts)}</div></section>
    <section class="card"><h2>By section</h2>${composition(r.findings)}</section>
  </div>
  <section class="card"><h2>Risk by area</h2>${heatmap(r.triage.groups)}</section>
  ${systemChangeCard(r)}${scorecardCard(r)}${holisticCard(r)}

  ${findingsSection(m, r.findings)}
  ${conventionsSection(m, r.findings)}
  ${zombiesSection(m, r.findings, r.triage.groups)}
  ${preflightSection(m, r.findings)}
  ${dependencySection(m, r.findings)}${foldedSection(m, r.findings)}
  ${triageSection(m, r.triage)}
  ${limitationsCard(r)}

  <footer>
    <span class="foot-brand">review-pr</span>
    <span>Generated ${esc(m.generatedAt)}</span>
    <span>${esc(m.repo || "")}${m.prNumber ? ` · PR #${esc(m.prNumber)}` : ""}</span>
  </footer>
</div></body></html>`;
}

// Exported for the test suite (render.test.ts) — lets it exercise the sanitizer and
// rich-content pipeline directly. The CLI below only runs when invoked as a script.
export { sanitizeHtml, sanitizeAttrs, renderInline, renderRich, page };
// (validateReport is exported at its definition above.)

// ---------- main ----------
if (import.meta.main) {
  const [, , inPath, outPath = "review-report/report.html"] = process.argv;
  if (!inPath) {
    console.error("usage: bun run render.ts <findings.json> [report.html]");
    process.exit(1);
  }
  const raw = await Bun.file(inPath).text();
  let report: Report;
  try {
    report = JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to parse ${inPath}: ${(e as Error).message}`);
    process.exit(1);
  }
  // Malformed-but-present shapes fail loudly; only genuinely absent sections
  // get the defensive defaults below.
  const problems = validateReport(report);
  if (problems.length) {
    console.error(`✗ ${inPath} is structurally malformed:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error("  See the top-level schema in this file's header (and SKILL.md Phase 4).");
    process.exit(1);
  }
  // defensive defaults
  report.meta ??= {};
  report.verdict ??= { decision: "comment", confidence: "low", summary: "" };
  report.triage ??= { groups: [], skipped: [] };
  report.triage.groups ??= [];
  report.triage.skipped ??= [];
  report.findings ??= [];

  await Bun.write(outPath, page(report));
  console.log(`✓ wrote ${outPath} (${report.findings.length} findings)`);
}
