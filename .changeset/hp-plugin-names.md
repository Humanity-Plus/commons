---
"humanity-plus-commons": minor
---

**The plugins are renamed `hp-review-toolkit` and `hp-code-publish`, and their home is now [humanityplus.solutions/commons/plugins](https://www.humanityplus.solutions/commons/plugins).** The Claude directory listing the `humanity-plus-*` names were made for isn't happening, so the plugins are published through this repo's marketplace. If you installed either plugin, swap it:

```bash
claude plugin marketplace update humanity-plus
claude plugin uninstall humanity-plus-review@humanity-plus
claude plugin install hp-review-toolkit@humanity-plus
```

Do the same for `humanity-plus-publish@humanity-plus` → `hp-code-publish@humanity-plus`, and add `--scope project` (or `local`) to the uninstall if you installed there. If your settings list the plugins under `enabledPlugins`, rename those keys. Slash commands move too, for example `/hp-review-toolkit:review-pr`. The skills CLI lane is unchanged.

The Review Toolkit's full guide moves from `review-toolkit.html` in this repo to [its own page](https://www.humanityplus.solutions/commons/plugins/review-toolkit), and the READMEs link there. The toolkit README's "What it runs and sends" now covers the verify skill, which starts your app locally, and `interrogate`, whose Codex seat sends its brief to OpenAI under your own Codex login. The bundle READMEs go back to the two-step marketplace install.
