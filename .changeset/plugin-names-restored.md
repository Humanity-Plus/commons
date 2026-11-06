---
"humanity-plus-commons": minor
---

**The plugins are back to their original names:** `humanity-plus-review` is `review-toolkit` again and `humanity-plus-publish` is `code-publish` again. The Claude directory listing they were renamed for isn't happening; the plugins are published through this repo's marketplace, with setup at humanityplus.solutions/commons/plugins. If you installed either plugin under the `humanity-plus-*` name, swap it:

```bash
claude plugin marketplace update humanity-plus
claude plugin uninstall humanity-plus-review@humanity-plus
claude plugin install review-toolkit@humanity-plus
```

Do the same for `humanity-plus-publish@humanity-plus` → `code-publish@humanity-plus`, and add `--scope project` (or `local`) to the uninstall if you installed there. If your settings list the plugins under `enabledPlugins`, rename those keys. Slash commands move back too, for example `/review-toolkit:review-pr`. The skills CLI lane is unchanged.

The bundle READMEs go back to the two-step marketplace install.
