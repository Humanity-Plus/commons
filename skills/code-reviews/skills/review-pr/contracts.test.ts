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
