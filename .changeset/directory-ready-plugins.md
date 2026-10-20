---
"humanity-plus-commons": minor
---

**The plugins are renamed for the Claude directory:** `review-toolkit` is now `humanity-plus-review` and `code-publish` is now `humanity-plus-publish`. The old names stop resolving once you update the marketplace, so if you installed either plugin, swap it for the new name:

```bash
claude plugin uninstall review-toolkit@humanity-plus
claude plugin install humanity-plus-review@humanity-plus
```

Do the same for `code-publish@humanity-plus` → `humanity-plus-publish@humanity-plus`, and add `--scope project` (or `local`) to the uninstall if you installed there. If your settings list the plugins under `enabledPlugins`, rename those keys rather than adding new ones. Slash commands move with the plugin, for example `/humanity-plus-review:review-pr`. The skills CLI lane is unchanged.

Each bundle README now has a one-step install line, says the skills are built for Claude Code, and lists everything the skills run and send. A few lens instructions in `review-pr` (triage, preflight, first-five, zombies) are reworded without changing what they check.
