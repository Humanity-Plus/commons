---
"humanity-plus-commons": patch
---

Rewrapped one sentence in the `primitives` lens so the plugin directory's security scan stops reading a line that began with `set;` as the shell builtin that dumps the environment. Lens behavior is unchanged.
