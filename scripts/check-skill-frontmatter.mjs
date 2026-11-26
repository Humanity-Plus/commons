#!/usr/bin/env bun
// Fails when a SKILL.md's frontmatter isn't strict YAML with a string `name`
// and `description`. Claude Code's plugin loader tolerates loose frontmatter,
// but the skills CLI parses it strictly and silently skips a skill that fails,
// so a bad header ships in the plugin while `npx skills add` never offers it.
// Runs under Bun for its built-in YAML parser.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repo } from "./plugins.mjs";

const skillFiles = execFileSync("git", ["ls-files", "skills/**/SKILL.md"], {
  cwd: repo,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const errors = [];

for (const path of skillFiles) {
  const match = readFileSync(join(repo, path), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    errors.push(`${path} has no frontmatter block.`);
    continue;
  }
  let data;
  try {
    data = Bun.YAML.parse(match[1]);
  } catch (error) {
    errors.push(
      `${path} frontmatter isn't valid YAML (${error.message}). Use a folded block (description: >) for text that contains ": ".`,
    );
    continue;
  }
  for (const field of ["name", "description"]) {
    if (typeof data?.[field] !== "string" || data[field].trim() === "") {
      errors.push(`${path} frontmatter needs a non-empty string \`${field}\`.`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`Skill frontmatter parses for ${skillFiles.length} skills.`);
