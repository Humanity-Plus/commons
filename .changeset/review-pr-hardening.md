---
"humanity-plus-commons": patch
---

**`review-pr` and `resolve-review` fixes, from a CodeRabbit review of a repo that vendored the skills:**

- A `findings.json` from an earlier commit no longer survives new commits on the same PR. `reset-workspace.sh` keeps it only when it describes the checked-out commit, and `resolve-review` stops and asks before editing from findings about different code (#19).
- Finding text can no longer close the report's own containers to render a spoofed verdict outside its card (#20).
- Copying `REVIEW.example.md` no longer opts you into running colleagues' PRs: the `execution: collaborators` line ships commented out (#21). If you copied the template before this release, check your `REVIEW.md`'s `## Trust` section.
- `check-clean.sh` no longer runs the check when it can't move `review-report/` aside (#22).
- `SKILL.md` gives one rule for when the `seams` lens runs: whenever triage finds interfaces between areas (#23).
