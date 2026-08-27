# humanity-plus-commons

## 0.1.1

### Patch Changes

- [#12](https://github.com/Humanity-Plus/commons/pull/12) [`6e983d7`](https://github.com/Humanity-Plus/commons/commit/6e983d726e56397f4d090fa630adf308473ae82d) Thanks [@Paalt](https://github.com/Paalt)! - Midnight redesign ([#11](https://github.com/Humanity-Plus/commons/pull/11)): the toolkit guide and the review report now share one visual language — near-black indigo-tinted surfaces, hairline borders, Inter + JetBrains Mono. The report renderer (`render.ts`, `recap.ts`) and the finding-style lens were updated to match, so reviews produced by `review-pr` pick up the new look.

- [#9](https://github.com/Humanity-Plus/commons/pull/9) [`4b113c7`](https://github.com/Humanity-Plus/commons/commit/4b113c7068efb2f3a81770b0e3bf37f7d9b60fc0) Thanks [@Paalt](https://github.com/Paalt)! - Add a unified release pipeline with changesets. The version in `package.json` is now the repo's release version; `scripts/sync-plugin-version.mjs` stamps it into every `skills/*/.claude-plugin/plugin.json`, the release workflow maintains a version PR and tags a GitHub Release on merge, and CI fails PRs whose plugin versions drift out of sync. The README documents how each install lane receives updates.
