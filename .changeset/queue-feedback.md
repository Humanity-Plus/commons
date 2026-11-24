---
"humanity-plus-commons": minor
---

Three PR-queue runs' worth of feedback: cheaper small reviews, a shipped bundle builder, and a review record that can describe a merged tree.

- **Small reviews cost less.** A test file counts with the source file it tests toward the light tier's two files. At the medium tier `intent`, `preflight`, and `primitives` may share one agent, each with its own output; `seams` and `blast-radius` keep their own. The primitives lens is skipped when the change touches no mapped source and adds no module.
- **`build-bundle.sh`** writes the lenses' materials to `review-report/bundle/`, one file per section, reading the repo's rules from the base branch. It replaces the single bundle file, which reached 187 KB on a repo with a large primitives map.
- **`meta.reviewedSha`** records the commit the lenses read when it is not the PR's pushed head, as when a loop merges the base branch in first. The fixer's freshness check and the workspace reset follow it, and `publish.ts` posts no inline comment until the PR has that commit.
- **`check-clean.sh`** now merges files written during a check back into the restored report folder instead of stranding them, and exits 3 when a passing check changed the working tree, which is how a stale generated file shows itself. Run whole-repo checks before the lenses start, not while they run.
- **`reset-workspace.sh`** archives the resolution log with its findings.
- A severity spelled `nit` is read as `nitpick`; any other value outside the enum is refused when rendering or publishing. The compact index carries each finding's lens.
- Lenses may write probe files under `review-report/lenses/probes/`. A PR body's mutation table written by the fix phase is spot-checked, not re-run in full.
- `fix-the-class` names the fallback for data already stored under an old rule: an always-check entry and a backfill issue. The verify-skill Doctor checks that the instance was launched from the commit being driven and that edits reach it.
