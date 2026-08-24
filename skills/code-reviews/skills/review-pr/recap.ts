// System-recap block for GitHub PR descriptions (visual-recap pattern):
// a collapsible <details> block with a mermaid map of the touched primitives,
// their composes/extends/adds classification, and invariant callouts. GitHub
// renders it natively — no external services.
//
//   bun run recap.ts review-report/findings.json                    # writes review-report/system-recap.md
//   bun run recap.ts review-report/findings.json --pr 218           # also upserts into PR #218's body
//
// Upsert is idempotent: the block lives between the start/end markers and is
// replaced in place; first run appends it to the body.
//
// Run from the REPO ROOT of the repo under review (findings path + gh resolve
// via cwd). Upserting with --pr edits the PR DESCRIPTION — more intrusive than
// posting a review, so it's for YOUR OWN PRs (you or your automation under your
// account), on explicit request only; same ownership rule as /review-fix.

const START = "<!-- system-recap:start -->";
const END = "<!-- system-recap:end -->";

type Classification = "composes" | "extends" | "adds";
const ORDER: Classification[] = ["adds", "extends", "composes"];
const RISK: Record<Classification, string> = { adds: "high", extends: "medium", composes: "low" };

// Mermaid + markdown-table cells share this: keep labels boring so a hostile
// diff can't smuggle markup into the PR body through a primitive name.
const plain = (s: unknown): string =>
  String(s ?? "")
    .replace(/[^\w\s,./:&+'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

const mmId = (s: string): string => plain(s).replace(/[^\w-]/g, "_") || "p";

// login: the posting account, for the attribution footer (github-comment-attribution
// convention) — the block lands in a PR description under the user's own name. All
// three identity parts (login + meta.model + meta.harness) or the plain stamp; a
// half-filled marker breaks the convention's exact format.
function buildBlock(report: any, login = ""): string {
  const sc = report.systemChange;
  if (!sc || !Array.isArray(sc.primitives)) {
    throw new Error("findings.json has no systemChange — run a review with the primitives lens first");
  }
  const prims: any[] = [...sc.primitives].sort(
    (a, b) => ORDER.indexOf(a.classification) - ORDER.indexOf(b.classification)
  );
  const added: any[] = Array.isArray(sc.added) ? sc.added : [];
  const overall: Classification = ORDER.includes(sc.overall) ? sc.overall : "composes";
  const verdict = plain(report.verdict?.decision || "");
  const sha = plain((report.meta?.headSha || "").slice(0, 7));

  const summary = `🧭 <b>System recap</b> — <b>${overall.toUpperCase()}</b> (${RISK[overall]} risk) · ${
    prims.length
  } primitive${prims.length === 1 ? "" : "s"} touched${
    added.length ? ` · <b>${added.length} NEW</b>` : ""
  }${verdict ? ` · review: ${verdict}` : ""}`;

  // Mermaid map: touched + added primitives, edges from relatesTo among them.
  const ids = new Set(prims.map((p) => mmId(p.id || p.name)));
  const nodes = [
    ...prims.map((p) => `  ${mmId(p.id || p.name)}["${plain(p.name || p.id)}"]:::${p.classification}`),
    ...added.map((a, i) => `  new_${i}["${plain(a.name)} (new)"]:::adds`),
  ];
  // Undirected edges: dedupe A---B / B---A into one line.
  const edgePairs = new Set<string>();
  for (const p of prims) {
    const from = mmId(p.id || p.name);
    for (const r of Array.isArray(p.relatesTo) ? p.relatesTo : []) {
      const to = mmId(r);
      if (ids.has(to) && to !== from) edgePairs.add([from, to].sort().join("|"));
    }
  }
  const edges = [...edgePairs].map((pair) => {
    const [a, b] = pair.split("|");
    return `  ${a} --- ${b}`;
  });
  const mermaid = [
    "```mermaid",
    "flowchart LR",
    ...nodes,
    ...edges,
    "  classDef adds fill:#5c1f22,stroke:#e5484d,color:#ffd7d8",
    "  classDef extends fill:#5a4212,stroke:#ffb224,color:#ffe8bd",
    "  classDef composes fill:#14361f,stroke:#46a758,color:#d3f2dc",
    "```",
  ].join("\n");

  const table = [
    "| Primitive | Area | Impact | Files |",
    "|---|---|---|---|",
    ...prims.map(
      (p) =>
        `| ${plain(p.name || p.id)} | ${plain(p.area || "")} | ${p.classification} | ${plain(
          (p.files || []).join(", ")
        )} |`
    ),
    ...added.map((a) => `| ${plain(a.name)} | — | **adds (unmapped)** | ${plain((a.files || []).join(", "))} |`),
  ].join("\n");

  const invariants = prims
    .flatMap((p) => (p.invariantsTouched || []).map((i: string) => `> ⚠ **${plain(p.name || p.id)}**: ${plain(i)}`))
    .join("\n");

  const mapLine = sc.mapUpdated === false && (added.length || prims.some((p) => p.classification !== "composes"))
    ? `\n**Map not updated in this PR** — ${plain(sc.mapPath || "primitives.yaml")} should change in the same PR as its primitives.\n`
    : "";

  // GitHub renders markdown inside <details> only with blank lines after
  // <summary> and around fenced blocks — the empty strings are load-bearing.
  const parts = [
    START,
    "<details>",
    `<summary>${summary}</summary>`,
    "",
    mermaid,
    "",
    table,
    "",
  ];
  if (invariants) parts.push(invariants, "");
  if (mapLine) parts.push(mapLine.trim(), "");
  const m = report.meta ?? {};
  const stamp = `review-pr${sha ? ` · ${sha}` : ""}`;
  parts.push(
    login && m.model && m.harness
      ? `<sub>🤖 Written on behalf of @${plain(login)} by ${plain(m.model)} via ${plain(m.harness)} · ${stamp}</sub>`
      : `<sub>generated by ${stamp}</sub>`,
    "",
    "</details>",
    END
  );
  return parts.join("\n");
}

function upsert(body: string, block: string): string {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start !== -1 && end !== -1 && end > start) {
    return body.slice(0, start) + block + body.slice(end + END.length);
  }
  return `${body.trimEnd()}\n\n${block}\n`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const prFlag = args.indexOf("--pr");
  const pr = prFlag !== -1 ? args[prFlag + 1] : null;
  const positional = args.filter((_, i) => prFlag === -1 || (i !== prFlag && i !== prFlag + 1));
  const [inPath, outPath = "review-report/system-recap.md"] = positional;
  if (!inPath) {
    console.error("usage: bun run recap.ts <findings.json> [system-recap.md] [--pr <number>]");
    process.exit(1);
  }
  if (pr && !/^\d+$/.test(pr)) {
    console.error(`--pr expects a number, got "${pr}"`);
    process.exit(1);
  }

  const report = JSON.parse(await Bun.file(inPath).text());
  // Only the --pr path posts anywhere, so only it needs the posting account.
  const login = pr
    ? Bun.spawnSync(["gh", "api", "user", "-q", ".login"]).stdout.toString().trim()
    : "";
  const block = buildBlock(report, login);
  await Bun.write(outPath, `${block}\n`);
  console.log(`wrote ${outPath}`);

  if (pr) {
    const view = Bun.spawnSync(["gh", "pr", "view", pr, "--json", "body", "-q", ".body"]);
    if (view.exitCode !== 0) {
      console.error(view.stderr.toString());
      process.exit(1);
    }
    const next = upsert(view.stdout.toString(), block);
    const tmp = `${outPath}.body.tmp`;
    await Bun.write(tmp, next);
    const edit = Bun.spawnSync(["gh", "pr", "edit", pr, "--body-file", tmp]);
    Bun.spawnSync(["rm", "-f", tmp]);
    if (edit.exitCode !== 0) {
      console.error(edit.stderr.toString());
      process.exit(1);
    }
    console.log(`upserted system-recap block into PR #${pr}`);
  }
}

export { buildBlock, upsert };
