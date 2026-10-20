#!/usr/bin/env node
// Fails when a plugin name drifts: a marketplace entry whose name differs from
// its plugin.json, or a tracked doc that installs, enables, or invokes a plugin
// the marketplace doesn't list. Release history (CHANGELOG.md, .changeset/) is
// exempt, since it records names as they were.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(repo, path), "utf8"));

const marketplace = readJson(".claude-plugin/marketplace.json");
const errors = [];
const plugins = new Map();

for (const entry of marketplace.plugins) {
  const manifest = readJson(join(entry.source, ".claude-plugin/plugin.json"));
  if (manifest.name !== entry.name) {
    errors.push(
      `.claude-plugin/marketplace.json lists "${entry.name}", but ${entry.source}/.claude-plugin/plugin.json is named "${manifest.name}".`,
    );
  }
  const skills = readdirSync(join(repo, entry.source, "skills"), {
    withFileTypes: true,
  })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  plugins.set(entry.name, new Set(skills));
}

const allSkills = new Set([...plugins.values()].flatMap((skills) => [...skills]));
const installRef = new RegExp(`\\b([a-z0-9-]+)@${marketplace.name}\\b`, "g");
const namespacedSkill = /\/([a-z0-9-]+):([a-z0-9-]+)/g;

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
