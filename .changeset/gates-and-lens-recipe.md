---
"humanity-plus-commons": patch
---

Gate selection proves coverage, and every lens has a materials recipe.

- **Pick gates from CI, and prove each one covers the changed files.** The baseline and the fix phase take the gate set from the CI workflow, by name, never the nearest-sounding package script, and record which changed files each gate reaches — the tool's globs and the workflow's own path filters and job conditions, so a job that did not run covers nothing (field: a workspace `lint` passed while CI's `lint:ci` caught script formatting it never scanned). A green CI run still stands in for running the gates, never for that pairing; a changed file no gate covers is recorded as a hole in the review's limitations and the fixer's over-to-you list. Stated once in `review-pr`; `resolve-review` and `review-fix` cite it, and a contract test keeps the three in step and refuses any return to script-name discovery.
- **Per-lens materials recipe.** `review-pr` states in one table what every lens, and a generalist carrying several lenses, is handed beyond the common set; the context bundle is fenced by section so a doc-heavy bundle costs the bug lenses nothing and a small review spawns mechanically.
- Contract phrase checks match on whitespace-collapsed text; the strings an agent copies into a shell still must sit on one line.
