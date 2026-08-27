#!/usr/bin/env node
// Copies package.json's version into every skills/*/.claude-plugin/plugin.json.
// Runs as part of `bun run version`, immediately after `changeset version`.
// With --check it changes nothing and exits 1 if any plugin version differs.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  readFileSync(join(repo, "package.json"), "utf8"),
);
const check = process.argv.includes("--check");

const pluginPaths = readdirSync(join(repo, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) =>
    join(repo, "skills", entry.name, ".claude-plugin", "plugin.json"),
  )
  .filter((path) => existsSync(path));

if (pluginPaths.length === 0) {
  console.error("No skills/*/.claude-plugin/plugin.json files found.");
  process.exit(1);
}

let outOfSync = false;
for (const pluginPath of pluginPaths) {
  const source = readFileSync(pluginPath, "utf8");
  const plugin = JSON.parse(source);

  if (plugin.version === version) {
    console.log(`${plugin.name}: ${version} (already in sync)`);
    continue;
  }

  if (check) {
    console.error(
      `${plugin.name}: plugin.json version is ${plugin.version}, package.json is ${version}. Run \`node scripts/sync-plugin-version.mjs\` to sync.`,
    );
    outOfSync = true;
    continue;
  }

  // Rewrite only the version line, to keep the key order and the formatting.
  const updated = source.replace(
    /("version"\s*:\s*")[^"]*(")/,
    `$1${version}$2`,
  );

  if (JSON.parse(updated).version !== version) {
    console.error(`Could not find a version field to replace in ${pluginPath}.`);
    process.exit(1);
  }

  writeFileSync(pluginPath, updated);
  console.log(`${plugin.name}: ${plugin.version} -> ${version}`);
}

if (outOfSync) process.exit(1);
