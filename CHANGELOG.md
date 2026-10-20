# humanity-plus-commons

## 0.3.0

### Minor Changes

- [#24](https://github.com/Humanity-Plus/commons/pull/24) [`3d80f7f`](https://github.com/Humanity-Plus/commons/commit/3d80f7fff32f94f4e866e82da6a9ea91cf1101cc) Thanks [@Paalt](https://github.com/Paalt)! - **The plugins are renamed for the Claude directory:** `review-toolkit` is now `humanity-plus-review` and `code-publish` is now `humanity-plus-publish`. The old names stop resolving once you update the marketplace, so if you installed either plugin, swap it for the new name:

  ```bash
  claude plugin uninstall review-toolkit@humanity-plus
  claude plugin install humanity-plus-review@humanity-plus
  ```

  Do the same for `code-publish@humanity-plus` → `humanity-plus-publish@humanity-plus`, and add `--scope project` (or `local`) to the uninstall if you installed there. If your settings list the plugins under `enabledPlugins`, rename those keys rather than adding new ones. Slash commands move with the plugin, for example `/humanity-plus-review:review-pr`. The skills CLI lane is unchanged.

  Each bundle README now has a one-step install line, says the skills are built for Claude Code, and lists everything the skills run and send. A few lens instructions in `review-pr` (triage, preflight, first-five, zombies) are reworded without changing what they check.

### Patch Changes

- [#26](https://github.com/Humanity-Plus/commons/pull/26) [`6250553`](https://github.com/Humanity-Plus/commons/commit/625055301690abdce9b22cc7c2d452effc392a8a) Thanks [@Paalt](https://github.com/Paalt)! - **`review-pr` and `resolve-review` fixes, from a CodeRabbit review of a repo that vendored the skills:**

  - A `findings.json` from an earlier commit no longer survives new commits on the same PR. `reset-workspace.sh` keeps it only when it describes the checked-out commit, and `resolve-review` stops and asks before editing from findings about different code ([#19](https://github.com/Humanity-Plus/commons/issues/19)).
  - Finding text can no longer close the report's own containers to render a spoofed verdict outside its card ([#20](https://github.com/Humanity-Plus/commons/issues/20)).
  - Copying `REVIEW.example.md` no longer opts you into running colleagues' PRs: the `execution: collaborators` line ships commented out ([#21](https://github.com/Humanity-Plus/commons/issues/21)). If you copied the template before this release, check your `REVIEW.md`'s `## Trust` section.
  - `check-clean.sh` no longer runs the check when it can't move `review-report/` aside ([#22](https://github.com/Humanity-Plus/commons/issues/22)).
  - `SKILL.md` gives one rule for when the `seams` lens runs: whenever triage finds interfaces between areas ([#23](https://github.com/Humanity-Plus/commons/issues/23)).

## 0.2.0

### Minor Changes

- [#15](https://github.com/Humanity-Plus/commons/pull/15) [`8cfe5f2`](https://github.com/Humanity-Plus/commons/commit/8cfe5f2728d8ebabd33a65168fa493dc2a9c9f69) Thanks [@Paalt](https://github.com/Paalt)! - Team/org reviews: repos can opt colleagues' PRs into execution trust (`## Trust` in REVIEW.md, `execution: collaborators` — collaborator-authored, same-repo-head PRs get baseline checks, experiments, and merged-tree gates in a disposable worktree), the seams lens traces migrated grants through every authorization consumer, skeptic verification can reframe a finding to the lesser defect that survives instead of discarding it, and resolve-review states reviewed-SHA vs current head and recommends a re-review after substantial security fixes. Publishing on private repos: `publish.ts --pages owner/name` hosts the HTML report via a Pages-publishing repo (Enterprise access-controlled Pages) and `--recap` puts the system-recap block in the review body for PRs whose description you don't own; the review footer timestamp is now human-readable (DD.MM.YYYY - HH:MM). create-pr includes the system-recap block at PR creation when a primitives map exists, and gains a retrofit mode that rewrites an existing PR's title and body to the same standard.

### Patch Changes

- [#16](https://github.com/Humanity-Plus/commons/pull/16) [`b9e1e8f`](https://github.com/Humanity-Plus/commons/commit/b9e1e8f49c4e3cf83cd25cd31ea65c63e8d6b63a) Thanks [@Paalt](https://github.com/Paalt)! - Report fix: the Dependencies (WARM) table no longer overflows its card. Long unbreakable content in the Notes column — 40-char commit SHAs, command strings in inline code, embedded markdown tables — used to set the column width, pushing the table past the card edge and crushing the Package column to one word per line. The table now uses fixed layout with proportional columns, and inline code and embedded tables wrap inside the Notes cell.

## 0.1.1

### Patch Changes

- [#12](https://github.com/Humanity-Plus/commons/pull/12) [`6e983d7`](https://github.com/Humanity-Plus/commons/commit/6e983d726e56397f4d090fa630adf308473ae82d) Thanks [@Paalt](https://github.com/Paalt)! - Midnight redesign ([#11](https://github.com/Humanity-Plus/commons/pull/11)): the toolkit guide and the review report now share one visual language — near-black indigo-tinted surfaces, hairline borders, Inter + JetBrains Mono. The report renderer (`render.ts`, `recap.ts`) and the finding-style lens were updated to match, so reviews produced by `review-pr` pick up the new look.

- [#9](https://github.com/Humanity-Plus/commons/pull/9) [`4b113c7`](https://github.com/Humanity-Plus/commons/commit/4b113c7068efb2f3a81770b0e3bf37f7d9b60fc0) Thanks [@Paalt](https://github.com/Paalt)! - Add a unified release pipeline with changesets. The version in `package.json` is now the repo's release version; `scripts/sync-plugin-version.mjs` stamps it into every `skills/*/.claude-plugin/plugin.json`, the release workflow maintains a version PR and tags a GitHub Release on merge, and CI fails PRs whose plugin versions drift out of sync. The README documents how each install lane receives updates.
