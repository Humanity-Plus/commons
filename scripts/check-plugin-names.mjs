#!/usr/bin/env node
// Fails when a plugin name drifts: a marketplace entry whose name differs from
// its plugin.json, or a tracked doc that installs, enables, or invokes a plugin
// the marketplace doesn't list. Release history (CHANGELOG.md, .changeset/) is
// exempt, since it records names as they were.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installRef as installRefFor, namespacedSkill, readPlugins, repo } from "./plugins.mjs";

const { marketplace, plugins: entries } = readPlugins();
const errors = [];
const plugins = new Map();

for (const { entry, manifest, skills } of entries) {
  if (manifest.name !== entry.name) {
    errors.push(
      `.claude-plugin/marketplace.json lists "${entry.name}", but ${entry.source}/.claude-plugin/plugin.json is named "${manifest.name}".`,
    );
  }
  plugins.set(entry.name, new Set(skills));
}

const allSkills = new Set([...plugins.values()].flatMap((skills) => [...skills]));
const installRef = installRefFor(marketplace.name);

const docs = execFileSync("git", ["ls-files", "*.md", "*.html", "*.json"], {
  cwd: repo,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((path) => !path.endsWith("CHANGELOG.md") && !path.startsWith(".changeset/"));

for (const path of docs) {
  const lines = readFileSync(join(repo, path), "utf8").split("\n");
  lines.forEach((line, index) => {
    const where = `${path}:${index + 1}`;
    for (const [, name] of line.matchAll(installRef)) {
      if (!plugins.has(name)) {
        errors.push(`${where} refers to "${name}@${marketplace.name}", which the marketplace doesn't list.`);
      }
    }
    for (const [, name, skill] of line.matchAll(namespacedSkill)) {
      if (!allSkills.has(skill)) continue;
      if (!plugins.get(name)?.has(skill)) {
        errors.push(`${where} invokes "/${name}:${skill}", but no listed plugin named "${name}" ships "${skill}".`);
      }
    }
  });
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`Plugin names consistent: ${[...plugins.keys()].join(", ")}.`);
