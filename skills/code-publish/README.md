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

Built for Claude Code: `create-pr` and `github-comment-attribution` run `git` and
`gh` in your local checkout. `write-clearly` works anywhere.

## Install

As a Claude Code plugin (managed bundle, skills namespaced as
`/humanity-plus-publish:create-pr` etc.):

```bash
claude plugin install humanity-plus-publish --marketplace Humanity-Plus/commons
```

Or as editable files via the skills CLI (any agent):

```bash
npx skills add Humanity-Plus/commons --skill write-clearly --skill create-pr --skill github-comment-attribution
```

Pick one lane — installing both gives you every skill twice.

## What it runs and sends

Pull requests, comments, issues, and replies go to GitHub through your `gh` login,
and only when you ask for one. No telemetry and no other servers.
