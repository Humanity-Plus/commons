---
"humanity-plus-commons": minor
---

**The plugins are renamed `hp-review-toolkit` and `hp-code-publish`, and their home is now [humanityplus.solutions/commons/plugins](https://www.humanityplus.solutions/commons/plugins).** The Claude directory listing the `humanity-plus-*` names were made for isn't happening, so the plugins are published through this repo's marketplace. If you installed either plugin, swap it:

```bash
claude plugin uninstall humanity-plus-review@humanity-plus
claude plugin marketplace update humanity-plus
claude plugin install hp-review-toolkit@humanity-plus
```

Do the same for `humanity-plus-publish@humanity-plus` → `hp-code-publish@humanity-plus`. If you are still on the names before those (`review-toolkit@humanity-plus`, `code-publish@humanity-plus`), uninstall those instead. Add `--scope project` (or `local`) to the uninstall if you installed there. If your settings list the plugins under `enabledPlugins`, rename those keys. Slash commands move too, for example `/hp-review-toolkit:review-pr`. The skills CLI lane is unchanged.

The Review Toolkit's full guide moves from `review-toolkit.html` in this repo to [its own page](https://www.humanityplus.solutions/commons/plugins/review-toolkit), and the READMEs link there. The toolkit README's "What it runs and sends" now covers the verify skill, which reviews and fixes on your own checkouts use to start your app, and `interrogate`, whose external seat (today Codex) sends its brief to that provider under your own login. The bundle READMEs go back to the two-step marketplace install.
