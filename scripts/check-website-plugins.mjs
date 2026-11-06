#!/usr/bin/env node
// The plugins are published from humanityplus.solutions, whose source lives in
// another repo (Humanity-Plus/humanity-plus, apps/marketing/lib/plugins.ts).
// Fails when a live page drifts from this repo: a skill directory the page
// doesn't list, a listed skill that no longer exists, or an install or
// invocation that names a plugin the marketplace doesn't list. The guide's
// skills table drifted from the skill directories twice while it lived here.
// WEBSITE_URL points the check at another deployment, such as a preview.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = (process.env.WEBSITE_URL ?? "https://www.humanityplus.solutions").replace(/\/$/, "");
const source = "apps/marketing/lib/plugins.ts in Humanity-Plus/humanity-plus";
const readJson = (path) => JSON.parse(readFileSync(join(repo, path), "utf8"));

const marketplace = readJson(".claude-plugin/marketplace.json");
const skillsOf = new Map(
  marketplace.plugins.map((entry) => [
    entry.name,
    readdirSync(join(repo, entry.source, "skills"), { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort(),
  ]),
);
const review = marketplace.plugins.find((entry) => entry.source === "./skills/code-reviews").name;

const pages = [
  { path: "/commons/plugins", plugins: [...skillsOf.keys()] },
  { path: "/commons/plugins/review-toolkit", plugins: [review] },
];

const installRef = new RegExp(`\\b([a-z0-9-]+)@${marketplace.name}\\b`, "g");
const namespacedSkill = /\/([a-z0-9-]+):([a-z0-9-]+)/g;
const allSkills = new Set([...skillsOf.values()].flat());
const errors = [];

for (const page of pages) {
  const url = `${site}${page.path}`;
  let html;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (error) {
    errors.push(`${url} could not be read (${error.message}).`);
    continue;
  }

  const listed = new Set([...html.matchAll(/data-skill="([a-z0-9-]+\/[a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const plugin of page.plugins) {
    for (const skill of skillsOf.get(plugin)) {
      if (!listed.has(`${plugin}/${skill}`)) {
        errors.push(`${url} doesn't list ${plugin}/${skill}. Add it to ${source}.`);
      }
    }
  }
  for (const entry of listed) {
    const [plugin, skill] = entry.split("/");
    if (!skillsOf.get(plugin)?.includes(skill)) {
      errors.push(`${url} lists ${entry}, which this repo doesn't ship. Remove or rename it in ${source}.`);
    }
  }

  for (const [, name] of html.matchAll(installRef)) {
    if (!skillsOf.has(name)) {
      errors.push(`${url} installs "${name}@${marketplace.name}", which the marketplace doesn't list.`);
    }
  }
  for (const [, name, skill] of html.matchAll(namespacedSkill)) {
    if (allSkills.has(skill) && !skillsOf.get(name)?.includes(skill)) {
      errors.push(`${url} invokes "/${name}:${skill}", but no listed plugin named "${name}" ships "${skill}".`);
    }
  }
}

if (errors.length > 0) {
  for (const error of [...new Set(errors)]) console.error(error);
  process.exit(1);
}
console.log(`${site} lists every skill of ${[...skillsOf.keys()].join(", ")}.`);
