// Guards the prose contracts between create-verify-skill (the producer) and its
// consumers (resolve-review, review-pr): the detection rule must be the same
// text everywhere, and every feature-file section a consumer cites must be one
// the generator mandates. A rename in one file fails here instead of in the field.
// Run: bun test  (from this directory)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const skills = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(skills, p), "utf8");
// Prose reflows: a contract phrase that wraps across a line break is still the
// same text (field: three phrase checks went red on a wrapped line, twice), so
// phrase checks — positive and negative — match on whitespace-collapsed text.
// Strings an agent copies into a shell (the detection command, the pid path, the
// evidence roots) and regexes over line structure (the ladder row) read the raw
// file: there a line break is a defect.
const flat = (s: string) => s.replace(/\s+/g, " ");
const generator = read("create-verify-skill/SKILL.md");
const consumers = { "resolve-review": read("resolve-review/SKILL.md"), "review-pr": read("review-pr/SKILL.md") };

const DETECTION = "find . -path '*/skills/verify-*/SKILL.md' -not -path '*/node_modules/*'";

test("the verify-skill detection rule is one text, in the generator and every consumer", () => {
  expect(generator).toContain(DETECTION);
  for (const [name, text] of Object.entries(consumers)) {
    expect(text, name).toContain(DETECTION);
    expect(flat(text), `${name} must not fall back to a shell glob`).not.toMatch(/at `\*\/skills\/verify-\*\/SKILL\.md`/);
  }
});

test("every feature-file section a consumer cites is one the generator mandates", () => {
  const featureMap = generator.slice(generator.indexOf("## 3. Write the feature map"), generator.indexOf("## 4."));
  const mandated = [...featureMap.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map((m) => m[1]);
  expect(mandated).toEqual(["Paths", "Personas", "How to get to it (user POV)", "Driving it with ‹harness›", "Proof", "Gotchas"]);
  for (const [name, text] of Object.entries(consumers)) {
    const cited = [...text.matchAll(/\*\*(Paths|Personas|Proof|Gotchas)\*\*/g)].map((m) => m[1]);
    expect(cited.length, `${name} cites no section`).toBeGreaterThan(0);
    for (const c of cited) expect(mandated, `${name} cites ${c}`).toContain(c);
  }
});

test("the evidence root and the phase-scoped layout are shared text", () => {
  expect(generator).toContain("review-report/verify/<feature>/<phase>-<sha7>/");
  expect(consumers["resolve-review"]).toContain("review-report/verify/<feature>/resolve-<sha7>/");
  expect(consumers["review-pr"]).toContain("review-report/verify/<feature>/review-<sha7>/");
});

// The light-tier predicate lives in exactly one place: the ladder row. Every
// restatement has drifted (field: "single file" beside a row that allowed two,
// then a README still saying "1 file" after the paragraph was fixed).
test("the light-tier predicate is stated once, in the ladder row", () => {
  const skill = consumers["review-pr"];
  expect(skill.match(/^\| \*\*light\*\* \|/gm)?.length).toBe(1);
  const restated = /light \(\d+ files?|single file under|one file under/i;
  for (const rel of ["review-pr/README.md", "../README.md", "../../../README.md", "review-fix/SKILL.md"]) {
    expect(read(rel), rel).not.toMatch(restated);
  }
  expect(skill.replace(/^\| \*\*light\*\* \|.*$/m, "")).not.toMatch(restated);
});

// Where a running instance keeps its pid file is a contract between the
// generator (which tells Launch where to write it) and check-clean.sh (which
// refuses to move review-report/ aside while those pids are alive). Field: the
// pid file lived under review-report/verify/ and a workspace reset archived it
// with another PR's findings while the server was still up.
test("the verify-skill runtime-state path is one text, in the generator and check-clean.sh", () => {
  const PIDS = "$(git rev-parse --git-dir)/verify/.pids";
  expect(generator).toContain(PIDS);
  expect(read("review-pr/check-clean.sh")).toContain(PIDS);
  expect(flat(generator)).not.toContain("review-report/verify/.pids");
});

// The shared-file rule narrows the Paths join by symbol. It is the generator's
// rule and every consumer cites it by that phrase (field: a three-file refactor
// of a shared helper selected eight journeys under the plain file join).
test("the shared-file narrowing rule is the generator's, cited by every consumer", () => {
  expect(flat(generator)).toContain("**A file listed by several features narrows by symbol.**");
  expect(generator).toContain("`not-affected`");
  for (const [name, text] of Object.entries(consumers)) expect(flat(text), name).toContain("narrows by symbol");
  expect(consumers["resolve-review"]).toContain("`not-affected`");
});

// The class mark is one field name across the reviewer, the renderer, the
// publisher, the fixer, and the hardener; the rule table it reads is one heading
// across the skill that keeps it and the two that consult it.
test("the class mark and the rule-table tokens are one text across producers and consumers", () => {
  // the producer sets the field by that name (anchored to the setting sentence,
  // so a rename that leaves a stray mention elsewhere still fails here)
  expect(flat(consumers["review-pr"])).toContain("sets `classEvidence`");
  expect(read("review-pr/render.ts")).toContain("classEvidence?: string");
  expect(read("review-pr/publish.ts")).toContain("classEvidence?: string");
  expect(flat(consumers["resolve-review"])).toContain("`classEvidence` (string)");
  expect(read("fix-the-class/SKILL.md")).toContain("`classEvidence`");
  // the rule table review-pr reads and fix-the-class/resolve-review write: one
  // heading, one column name, one prose-only token
  for (const token of ["## Rules and what enforces them", "Enforced by", "`prose only`"]) {
    for (const rel of ["fix-the-class/SKILL.md", "review-pr/SKILL.md", "resolve-review/SKILL.md"]) {
      expect(flat(read(rel)), `${rel} lacks ${token}`).toContain(token);
    }
  }
});

// Gate selection is one rule: CI's set, each gate shown to cover the changed
// files (field: a workspace `lint` passed while CI's `lint:ci` failed on script
// formatting it never scanned). review-pr states it once; the fix phase and the
// one-pass loop cite it by its opening words, and nobody still discovers gates
// by package-script name.
test("the gate-selection rule is review-pr's one statement, cited by the fix phase and review-fix", () => {
  const RULE = "pick gates from CI, and prove each one covers the changed files";
  const heading = `**${RULE[0].toUpperCase()}${RULE.slice(1)}.**`;
  const all = { ...consumers, "review-fix": read("review-fix/SKILL.md") };
  const statements = Object.values(all).map(flat).join("\n").split(heading).length - 1;
  expect(statements, "the rule is stated once, in review-pr").toBe(1);
  const pr = flat(consumers["review-pr"]);
  expect(pr).toContain(heading);
  for (const clause of ["never the nearest-sounding `package.json` script", "A changed file no gate covers is a hole", 'per "pick gates from CI" below']) {
    expect(pr, clause).toContain(clause);
  }
  for (const rel of ["resolve-review/SKILL.md", "review-fix/SKILL.md"]) expect(flat(read(rel)), rel).toContain(`**${RULE}**`);
  for (const [name, text] of Object.entries(all)) {
    expect(flat(text), `${name} still discovers gates by script name`).not.toMatch(/discover(ed)? (them )?from (its own )?`package\.json`/);
  }
});

// External runners are one rule for both branches that seat them, and the rule
// is a safety gate: a runner's reading mode stops edits, not commands, and its
// provider receives what the seat reads. Each sentence below is one a careless
// edit could soften without any behaviour test noticing.
test("the external-runner gate is stated once, both branches cite it, and its sentences hold", () => {
  const raw = consumers["review-pr"];
  const pr = flat(raw);
  expect(pr.split("**Runners are detected, never assumed.**").length - 1).toBe(1);
  const section = (heading: string) => {
    const from = raw.indexOf(heading);
    expect(from, `${heading} is missing`).toBeGreaterThan(-1);
    const next = raw.slice(from + heading.length).search(/\n#{2,4} /);
    expect(next, `${heading} has no following heading`).toBeGreaterThan(-1);
    return flat(raw.slice(from, from + heading.length + next));
  };
  const runners = section("#### External runners");
  for (const sentence of [
    "**A reading form stops edits, not commands.**",
    "An external seat runs only where an experiment may: an **owned checkout**, or a PR the repo's `## Trust` section covers",
    "the seat also needs its runner named on a `runners:` line in the base branch's `## Trust` section",
    "the seat is refused and noted",
    "**Each seat gets a scratch worktree, never the review checkout.**",
    "**The brief carries the report-only lines itself**",
    "says the seat **has no shell**",
    "never quietly rerun on the host",
    "a reading seat is never handed a writing mode",
  ]) expect(runners, sentence).toContain(sentence);
  const panel = section("#### Panel branch");
  const interrogate = section("#### Interrogate branch");
  for (const [name, text] of [["Panel", panel], ["Interrogate", interrogate]] as const) expect(text, name).toContain('"External runners"');
  expect(panel).toContain("**One round, never a loop.**");
  expect(panel).toContain("bare `panel` is refused");
  // the table rows, whole: each reading form carries its no-edit switch and says where the answer is
  const row = (runner: string) => raw.split("\n").find((l) => l.startsWith(`| \`${runner}\``)) ?? "";
  expect(row("codex")).toContain('`codex exec -C <seat-dir> -s read-only [-m <model>] -o <answer-file> "<prompt>"` — the answer is `<answer-file>`');
  expect(row("agy")).toContain('`agy --print "<prompt>" --mode plan --sandbox [--model <id>] --print-timeout <seconds>s --output-format json`');
  expect(row("agy")).toContain("only when its `status` is `SUCCESS` and there is no `denied_actions` entry");
  expect(row("agy")).toContain("| none verified: reading seats only |"); // no writing form claimed for agy
  // the template and both READMEs carry the owner's line
  for (const rel of ["review-pr/README.md", "../README.md"]) expect(read(rel), rel).toContain("`runners:`");
  expect(read("review-pr/REVIEW.example.md")).toMatch(/^<!-- runners: [a-z, ]+ -->$/m); // shipped commented out, like `execution:`
});

// The bundle's file names are a contract between the script that writes them
// and the text that tells each lens which to read. Checked in both directions,
// and across every doc that describes the materials: a contract this toolkit
// replaces has outlived its replacement in a sibling doc three times in one
// change (the bundle file, the index shape, the resolution log's name).
test("the bundle files are the same set in the script and the skill, and no doc keeps the single-file bundle", () => {
  const script = read("review-pr/build-bundle.sh");
  const written = [...script.matchAll(/>"\$out\/([a-z0-9-]+)\.md"/g)].map((m) => `${m[1]}.md`).sort();
  expect(written).toEqual(["common.md", "conventions.md", "diff.md", "intent.md", "primitives.md"]);
  const pr = flat(consumers["review-pr"]);
  for (const file of written) expect(pr, `the skill never names ${file}`).toContain(`\`${file}\``);
  const named = [...new Set([...pr.matchAll(/`bundle\/([a-z0-9-]+\.md)`/g)].map((m) => m[1]))];
  expect(named.length).toBeGreaterThan(0);
  for (const file of named) expect(written, `the skill names bundle/${file}, which the script does not write`).toContain(file);
  expect(pr).toContain("<this-skill-dir>/build-bundle.sh");
  for (const rel of ["review-pr/SKILL.md", "review-pr/README.md", "../README.md", "review-fix/SKILL.md", "resolve-review/SKILL.md", "review-pr/lenses/finding-style.md"]) {
    const text = flat(read(rel));
    for (const gone of ["context-bundle.md", "=== section:", "one bundle file"]) expect(text, `${rel} still says "${gone}"`).not.toContain(gone);
  }
});

// The commit the lenses read has one name and one meaning in every reader.
test("the reviewed commit is one term across the skill, the fixer, and the scripts", () => {
  const pr = flat(consumers["review-pr"]);
  expect(pr).toContain("Record it as `meta.reviewedSha`");
  expect(pr, "a seat or rerun worktree must be cut at the reviewed commit").not.toMatch(/git worktree add <[a-z-]+> <headSha>/);
  expect(pr).toContain("the commit it reviewed (`meta.reviewedSha`, else `meta.headSha`)"); // the manual reset fallback
  expect(pr, "the anchor rule names the commit the lenses read").not.toContain("Anchor to the head SHA**");
  expect(flat(read("review-pr/lenses/interrogate.md")), "a seat's worktree is cut at the reviewed commit").not.toContain("checked out at the head SHA");
  expect(flat(read("review-issues/SKILL.md"))).toContain("a review that recorded another `meta.reviewedSha` read a merged tree");
  const fixer = flat(consumers["resolve-review"]);
  expect(fixer).toContain("`meta.reviewedSha` when the review recorded one, else `meta.headSha`");
  expect(fixer).toContain("the commit the review read (`meta.reviewedSha`, else `meta.headSha`)");
  expect(read("review-pr/reset-workspace.sh")).toContain(".meta.reviewedSha // .meta.headSha");
  expect(read("review-pr/publish.ts")).toContain("checkReviewedSha(report.meta, "); // wired into main, not only defined
  expect(read("review-pr/render.ts")).toContain("|| offHead(m)) return \"\";"); // no line link off-head
});

// Two more contracts with readers outside SKILL.md.
test("the compact index shape and the archived resolution log are stated the same by every doc that uses them", () => {
  const INDEX = "`{ id, lens, severity, category, file, line, title, claim, mechanism, fix }`";
  for (const rel of ["review-pr/SKILL.md", "review-pr/lenses/finding-style.md"]) expect(flat(read(rel)), rel).toContain(INDEX);
  for (const rel of ["review-pr/SKILL.md", "resolve-review/SKILL.md", "review-issues/SKILL.md"]) {
    expect(flat(read(rel)), rel).toContain("`resolution-<label>.md`");
  }
  expect(read("review-pr/reset-workspace.sh")).toContain('"review-report/resolution-${label}.md"');
});

// What the guard's exit 3 compares is stated by the script and by both skills
// that tell an agent how to read it.
test("check-clean's tree comparison is described as status and content wherever it is described", () => {
  expect(read("review-pr/check-clean.sh")).toContain("xargs -0 cksum --");
  for (const rel of ["review-pr/SKILL.md", "resolve-review/SKILL.md"]) {
    const text = flat(read(rel));
    expect(text, rel).not.toContain("compares `git status --porcelain` before and after");
    expect(text, rel).toMatch(/compares the tree before and after[^.]*content/);
  }
});
