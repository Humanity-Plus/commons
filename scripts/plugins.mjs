// The marketplace's plugins and the patterns that find them in text, shared by
// check-plugin-names.mjs (this repo's docs) and check-website-plugins.mjs (the
// website), so both read one grammar.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

const readJson = (path) => JSON.parse(readFileSync(join(repo, path), "utf8"));

/** The marketplace, plus each entry's manifest and skill folder names. */
export function readPlugins() {
  const marketplace = readJson(".claude-plugin/marketplace.json");
  const plugins = marketplace.plugins.map((entry) => ({
    entry,
    manifest: readJson(join(entry.source, ".claude-plugin/plugin.json")),
    skills: readdirSync(join(repo, entry.source, "skills"), {
      withFileTypes: true,
    })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort(),
  }));
  return { marketplace, plugins };
}

/** Matches `<plugin>@<marketplace>`: an install or enable reference. */
export const installRef = (marketplaceName) =>
  new RegExp(`\\b([a-z0-9-]+)@${marketplaceName}\\b`, "g");

/** Matches `/<plugin>:<skill>`: a namespaced slash command. */
export const namespacedSkill = /\/([a-z0-9-]+):([a-z0-9-]+)/g;
