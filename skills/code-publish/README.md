# Code publish

Three skills for the moment work leaves your machine and lands on GitHub —
where it stops being code and starts being communication:

| Skill | What it does |
|---|---|
| [write-clearly](skills/write-clearly/SKILL.md) | Clarity rules for prose deliverables — PR bodies, issue text, docs, reports. Cuts filler and hedging, names sources, prefers mechanism or number over vibes. Explicitly **not** authorship camouflage. |
| [create-pr](skills/create-pr/SKILL.md) | Opens or updates a pull request with an outcome-led title in the repo's own convention and a problem-first description a reviewer can follow without reconstructing the motivation from the diff. |
| [github-comment-attribution](skills/github-comment-attribution/SKILL.md) | Prepends a one-line attribution header to agent-authored GitHub comments, issues, and replies, so humans and agents can tell them apart from the account owner's own words. |

They share one philosophy: **disclose who wrote it, and make what was written
easy to read.** Attribution and clarity are complements — the opposite of
skills that try to make agent output pass as human.

## Install

As a Claude Code plugin (managed bundle, skills namespaced as
`/code-publish:create-pr` etc.):

```bash
claude plugin marketplace add Humanity-Plus/commons
claude plugin install code-publish@humanity-plus
```

Or as editable files via the skills CLI (any agent):

```bash
npx skills add Humanity-Plus/commons --skill write-clearly --skill create-pr --skill github-comment-attribution
```

Pick one lane — installing both gives you every skill twice.
