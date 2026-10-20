---
"humanity-plus-commons": minor
---

**The plugins are renamed for the Claude directory:** `review-toolkit` is now `humanity-plus-review` and `code-publish` is now `humanity-plus-publish`. If you installed either plugin, reinstall it under the new name (`claude plugin install humanity-plus-review@humanity-plus`), and update any `enabledPlugins` entry in your settings. Slash commands move with it, for example `/humanity-plus-review:review-pr`. The skills CLI lane is unchanged.

Each bundle README now has a one-step install line, says the skills are built for Claude Code, and lists everything the skills run and send. A few lens instructions in `review-pr` (triage, preflight, first-five, zombies) are reworded without changing what they check.
