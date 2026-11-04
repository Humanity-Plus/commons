---
"humanity-plus-commons": patch
---

Gate selection proves coverage, and every lens has a materials recipe.

- **Pick gates from CI, and prove each one covers the changed files.** The baseline and the fix phase take the gate set from the CI workflow, by name, never the nearest-sounding package script, and record which changed files each gate reaches (field: a workspace `lint` passed while CI's `lint:ci` caught script formatting it never scanned). A changed file no gate covers is reported as a hole. Stated once in `review-pr`; `resolve-review` and `review-fix` cite it, and a contract test keeps the three in step.
- **Per-lens materials recipe.** `review-pr` now states in one table what every lens is handed beyond the common set, and the context bundle is sectioned by lens so a doc-heavy bundle costs the bug lenses nothing and a small review spawns mechanically.
