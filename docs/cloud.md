# Cloud-specific instructions

Setup notes for agents running in cloud environments (no local machine state).
Everything in `AGENTS.md` still applies; this doc only covers environment
bootstrap.

## Environment

- Bun is the package manager: `bun install`. The only dependency is the
  changesets tooling; the repo content itself is markdown plus the review
  toolkit's TypeScript renderers.

## Running services

- None. Nothing in this repo runs as a service.

## Key commands (see root README for full list)

- `bun run check-plugin-version` — verify every `plugin.json` matches
  `package.json` (what CI runs).
- `bunx changeset` — add a changeset to the current branch.
- `bunx changeset status` — list pending changesets.

## Caveats

- The version-PR CI quirk documented under Known Issues in `AGENTS.md` applies
  here too: "no checks reported" on the "chore: version plugins" PR is
  expected, not a failure.
