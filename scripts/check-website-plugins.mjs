#!/usr/bin/env node
// The plugins are published from humanityplus.solutions, whose plugin list
// lives in the website repo (lib/plugins.ts). Fails when a live page drifts
// from this repo: a skill folder the page doesn't list, a listed skill that no
// longer exists, a plugin's install command missing from the plugins page, or
// an install or invocation naming a plugin the marketplace doesn't list.
// WEBSITE_URL points the check at another deployment, such as a local build.

import { pathToFileURL } from "node:url";
import { installRef, namespacedSkill, readPlugins } from "./plugins.mjs";

const SITE_LIST = "the website's plugin list (lib/plugins.ts)";
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 3_000;

/**
 * Compares one page's HTML with the marketplace. `skillsOf` maps every listed
 * plugin to its skill folders; `expected` names the plugins this page lists;
 * `requireInstall` asks for each expected plugin's install command too.
 */
export function pageDrift(html, { url, skillsOf, marketplaceName, expected, requireInstall = false }) {
  const listed = new Set([...html.matchAll(/data-skill="([a-z0-9-]+\/[a-z0-9-]+)"/g)].map((m) => m[1]));
  if (listed.size === 0) {
    return [`${url} lists no skills at all. It may not be the plugins page: an error page or a login wall answers the same way.`];
  }

  const errors = [];
  for (const plugin of expected) {
    for (const skill of skillsOf.get(plugin)) {
      if (!listed.has(`${plugin}/${skill}`)) errors.push(`${url} doesn't list ${plugin}/${skill}. Add it to ${SITE_LIST}.`);
    }
  }
  for (const entry of listed) {
    const [plugin, skill] = entry.split("/");
    if (!skillsOf.get(plugin)?.includes(skill)) {
      errors.push(`${url} lists ${entry}, which this repo doesn't ship. Remove or rename it in ${SITE_LIST}.`);
    }
  }

  const installed = new Set();
  for (const [, name] of html.matchAll(installRef(marketplaceName))) {
    installed.add(name);
    if (!skillsOf.has(name)) errors.push(`${url} installs "${name}@${marketplaceName}", which the marketplace doesn't list.`);
  }
  if (requireInstall) {
    for (const plugin of expected) {
      if (!installed.has(plugin)) errors.push(`${url} has no install command for ${plugin}@${marketplaceName}.`);
    }
  }

  const allSkills = new Set([...skillsOf.values()].flat());
  for (const [, name, skill] of html.matchAll(namespacedSkill)) {
    if (allSkills.has(skill) && !skillsOf.get(name)?.includes(skill)) {
      errors.push(`${url} invokes "/${name}:${skill}", but no listed plugin named "${name}" ships "${skill}".`);
    }
  }
  return [...new Set(errors)];
}

/** Fetches a page, retrying network errors and 5xx answers; a redirect off the page's origin is an error. */
export async function fetchPage(url, { attempts = ATTEMPTS, retryDelayMs = RETRY_DELAY_MS, fetchImpl = fetch } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
      if (response.redirected && new URL(response.url).origin !== new URL(url).origin) {
        throw new Error(`redirected to ${response.url}`, { cause: "final" });
      }
      if (response.ok) return await response.text();
      lastError = new Error(`HTTP ${response.status}`, { cause: response.status < 500 ? "final" : undefined });
    } catch (error) {
      lastError = error;
    }
    if (lastError.cause === "final") break;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
  }
  throw lastError;
}

async function main() {
  const site = (process.env.WEBSITE_URL ?? "https://www.humanityplus.solutions").replace(/\/$/, "");
  const { marketplace, plugins } = readPlugins();
  const skillsOf = new Map(plugins.map(({ entry, skills }) => [entry.name, skills]));
  const review = plugins.find(({ entry }) => entry.source === "./skills/code-reviews").entry.name;
  const pages = [
    { path: "/commons/plugins", expected: [...skillsOf.keys()], requireInstall: true },
    { path: "/commons/plugins/review-toolkit", expected: [review] },
  ];

  const errors = [];
  for (const page of pages) {
    const url = `${site}${page.path}`;
    try {
      const html = await fetchPage(url);
      errors.push(...pageDrift(html, { ...page, url, skillsOf, marketplaceName: marketplace.name }));
    } catch (error) {
      errors.push(`${url} could not be read (${error.message}).`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(`${site} lists every skill of ${[...skillsOf.keys()].join(", ")}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
