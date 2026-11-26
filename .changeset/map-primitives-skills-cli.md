---
"humanity-plus-commons": patch
---

`map-primitives` now installs with the skills CLI. Its description wasn't valid YAML, so `npx skills add Humanity-Plus/commons` silently left it out, while the Claude Code plugin loaded it fine. CI now checks that every skill's frontmatter parses.
