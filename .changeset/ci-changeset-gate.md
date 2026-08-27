---
"humanity-plus-commons": patch
---

CI now requires a changeset on any PR that changes skill content, so releases can't silently ship undocumented changes. The version PR and docs/infra-only PRs are exempt; `bunx changeset --empty` is the escape hatch for skill changes that shouldn't appear in release notes.
