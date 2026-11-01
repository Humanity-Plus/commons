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
const generator = read("create-verify-skill/SKILL.md");
const consumers = { "resolve-review": read("resolve-review/SKILL.md"), "review-pr": read("review-pr/SKILL.md") };

const DETECTION = "find . -path '*/skills/verify-*/SKILL.md' -not -path '*/node_modules/*'";

test("the verify-skill detection rule is one text, in the generator and every consumer", () => {
  expect(generator).toContain(DETECTION);
  for (const [name, text] of Object.entries(consumers)) {
    expect(text, name).toContain(DETECTION);
    expect(text, `${name} must not fall back to a shell glob`).not.toMatch(/at `\*\/skills\/verify-\*\/SKILL\.md`/);
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
  for (const rel of ["review-pr/README.md", "../README.md", "../../../README.md", "../review-toolkit.html", "review-fix/SKILL.md"]) {
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
  expect(generator).not.toContain("review-report/verify/.pids");
});

// The shared-file rule narrows the Paths join by symbol. It is the generator's
// rule and every consumer cites it by that phrase (field: a three-file refactor
// of a shared helper selected eight journeys under the plain file join).
test("the shared-file narrowing rule is the generator's, cited by every consumer", () => {
  expect(generator).toContain("**A file listed by several features narrows by symbol.**");
  expect(generator).toContain("`not-affected`");
  for (const [name, text] of Object.entries(consumers)) expect(text, name).toContain("narrows by symbol");
  expect(consumers["resolve-review"]).toContain("`not-affected`");
});

// The class mark is one field name across the reviewer, the renderer, the
// publisher, the fixer, and the hardener; the rule table it reads is one heading
// across the skill that keeps it and the two that consult it.
test("the class mark and the rule-table heading are one text across producers and consumers", () => {
  const FIELD = "classEvidence";
  for (const rel of ["review-pr/SKILL.md", "review-pr/render.ts", "review-pr/publish.ts", "resolve-review/SKILL.md", "fix-the-class/SKILL.md"]) {
    expect(read(rel), rel).toContain(FIELD);
  }
  const HEADING = "## Rules and what enforces them";
  for (const rel of ["fix-the-class/SKILL.md", "review-pr/SKILL.md", "resolve-review/SKILL.md"]) {
    expect(read(rel), rel).toContain(HEADING);
  }
});
