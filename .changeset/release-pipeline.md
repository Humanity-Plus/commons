---
"humanity-plus-commons": patch
---

Add a unified release pipeline with changesets. The version in `package.json` is now the repo's release version; `scripts/sync-plugin-version.mjs` stamps it into every `skills/*/.claude-plugin/plugin.json`, the release workflow maintains a version PR and tags a GitHub Release on merge, and CI fails PRs whose plugin versions drift out of sync. The README documents how each install lane receives updates.
