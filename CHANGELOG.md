# humanity-plus-commons

## 0.2.0

### Minor Changes

- [#15](https://github.com/Humanity-Plus/commons/pull/15) [`8cfe5f2`](https://github.com/Humanity-Plus/commons/commit/8cfe5f2728d8ebabd33a65168fa493dc2a9c9f69) Thanks [@Paalt](https://github.com/Paalt)! - Team/org reviews: repos can opt colleagues' PRs into execution trust (`## Trust` in REVIEW.md, `execution: collaborators` — collaborator-authored, same-repo-head PRs get baseline checks, experiments, and merged-tree gates in a disposable worktree), the seams lens traces migrated grants through every authorization consumer, skeptic verification can reframe a finding to the lesser defect that survives instead of discarding it, and resolve-review states reviewed-SHA vs current head and recommends a re-review after substantial security fixes. Publishing on private repos: `publish.ts --pages owner/name` hosts the HTML report via a Pages-publishing repo (Enterprise access-controlled Pages) and `--recap` puts the system-recap block in the review body for PRs whose description you don't own; the review footer timestamp is now human-readable (DD.MM.YYYY - HH:MM). create-pr includes the system-recap block at PR creation when a primitives map exists, and gains a retrofit mode that rewrites an existing PR's title and body to the same standard.

### Patch Changes

- [#16](https://github.com/Humanity-Plus/commons/pull/16) [`b9e1e8f`](https://github.com/Humanity-Plus/commons/commit/b9e1e8f49c4e3cf83cd25cd31ea65c63e8d6b63a) Thanks [@Paalt](https://github.com/Paalt)! - Report fix: the Dependencies (WARM) table no longer overflows its card. Long unbreakable content in the Notes column — 40-char commit SHAs, command strings in inline code, embedded markdown tables — used to set the column width, pushing the table past the card edge and crushing the Package column to one word per line. The table now uses fixed layout with proportional columns, and inline code and embedded tables wrap inside the Notes cell.

## 0.1.1

### Patch Changes

- [#12](https://github.com/Humanity-Plus/commons/pull/12) [`6e983d7`](https://github.com/Humanity-Plus/commons/commit/6e983d726e56397f4d090fa630adf308473ae82d) Thanks [@Paalt](https://github.com/Paalt)! - Midnight redesign ([#11](https://github.com/Humanity-Plus/commons/pull/11)): the toolkit guide and the review report now share one visual language — near-black indigo-tinted surfaces, hairline borders, Inter + JetBrains Mono. The report renderer (`render.ts`, `recap.ts`) and the finding-style lens were updated to match, so reviews produced by `review-pr` pick up the new look.

- [#9](https://github.com/Humanity-Plus/commons/pull/9) [`4b113c7`](https://github.com/Humanity-Plus/commons/commit/4b113c7068efb2f3a81770b0e3bf37f7d9b60fc0) Thanks [@Paalt](https://github.com/Paalt)! - Add a unified release pipeline with changesets. The version in `package.json` is now the repo's release version; `scripts/sync-plugin-version.mjs` stamps it into every `skills/*/.claude-plugin/plugin.json`, the release workflow maintains a version PR and tags a GitHub Release on merge, and CI fails PRs whose plugin versions drift out of sync. The README documents how each install lane receives updates.
