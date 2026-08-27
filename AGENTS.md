# AGENTS.md

# What "Humanity Plus Commons" is

The public repo where Humanity Plus publishes the skills, frameworks, and
processes we use to build our own products, under MIT. It distributes through
two lanes that must both keep working: the skills CLI (`npx skills add
Humanity-Plus/commons`, which copies editable skill files) and self-hosted
Claude Code plugins (`.claude-plugin/marketplace.json` at the root, one plugin
per bundle under `skills/<bundle>/`). Releases are driven by changesets — see
the Releasing section in `README.md`.

## Requirements

<!-- Hard gates. Every task must satisfy these. Keep this list under 10 items. -->

- Any PR that changes skill content under `skills/**` includes a changeset
  (`bunx changeset`) with human-readable release notes — that text becomes the
  CHANGELOG entry plugin users read. Use `bunx changeset --empty` only for a
  skill change that shouldn't appear in release notes. CI's "Changeset present
  for skill changes" job fails otherwise.
- Never merge a PR while any check is failing, pending, or not yet started.
  The changeset gate is not a required status check — a red ✗ or a spinner
  still means stop and resolve first.
- Never edit `version` in any `plugin.json` by hand. It is stamped from
  `package.json` by `scripts/sync-plugin-version.mjs` during a release, and CI
  fails PRs where the two drift.
- Every distributable skill lives at `skills/<bundle>/skills/<name>/SKILL.md`.
  Both lanes discover skills at that path (the plugin loader from each
  bundle's root, the skills CLI by walking `skills/`) — don't move or rename
  skill folders without checking both.
- Plugins ship no `hooks/hooks.json`. Plugin hooks activate silently on
  install, which would ambush public users; the pre-PR review hook stays
  opt-in via `skills/code-reviews/hooks/README.md`.
- Everything merged here is public. No internal product details, credentials,
  or unsanitized examples from private repos — worked examples are genericized
  before they land (see `REVIEW.worked-example.md` for the pattern).
- Don't add comments for obvious content; focus on non-obvious,
  decision-relevant context that readers cannot infer from the diff.

## Known Issues

<!--
  Entries here represent things that CANNOT be fixed by improving the codebase.
  If an issue can be resolved by refactoring, renaming, or restructuring — do that
  instead and don't add an entry.

  Format: [YYYY-MM-DD agent] One to three sentences.
  Add new entries at the bottom. Don't remove others' entries; amend if outdated.
-->

- [2026-08-27 agent] The changesets version PR ("chore: version plugins") is
  pushed with the default `GITHUB_TOKEN`, so GitHub never triggers CI on it —
  "no checks reported" on that PR is expected, not a failure. A human-initiated
  close/reopen (`gh pr close <n> && gh pr reopen <n>`) triggers CI if a run is
  wanted before merging.

## Agent Notes

<!--
  When you encounter something surprising, confusing, or that caused you to waste
  time, do NOT silently work around it. Instead:

  1. Flag it to the developer in your response.
  2. Add a short entry below describing what confused you and why.

  The developer will evaluate whether to fix the codebase (and remove your entry)
  or keep the entry for future agents. Most entries here are temporary.

  Format: [YYYY-MM-DD agent] One to three sentences.
-->

## Cloud-specific instructions

Running in a cloud environment? Environment bootstrap and key commands are in
[docs/cloud.md](docs/cloud.md). Local agents can ignore that doc.
