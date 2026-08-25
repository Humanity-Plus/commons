# Humanity Plus Commons

[![skills.sh](https://skills.sh/b/humanity-plus/commons)](https://skills.sh/humanity-plus/commons)

The Humanity Plus Commons is where we publish the frameworks, skills, and processes
we use to build our own products, openly and under MIT. Take them as they are, or
adapt them to your team.

## Installation

Two ways in, two philosophies, **pick one**. The skills CLI copies editable skill
files into your agent, so you can hack on them and make them your own; the Claude
Code plugins install the Review Toolkit and Code Publish bundles as managed
plugins. Installing both lanes leaves you with the same skills twice.

### Option 1: skills CLI (any agent, editable files)

Works with Claude Code, Cursor, Codex, and most other coding agents:

```bash
npx skills add Humanity-Plus/commons
```

The installer lists every skill in this repo and lets you pick which ones to take
and which agents to install them to. Useful variants:

```bash
npx skills add Humanity-Plus/commons --list             # see what's available
npx skills add Humanity-Plus/commons --skill review-pr  # take one specific skill
npx skills add Humanity-Plus/commons -g                 # install globally, not per-project
```

Skills are installed as ordinary files you own and can edit. Nothing updates behind
your back, pull our latest changes when you want them with `npx skills update`.

### Option 2: Claude Code plugins (managed bundles)

Claude Code only. Add the marketplace once, then install the bundles you want:

```bash
claude plugin marketplace add Humanity-Plus/commons
```

```bash
claude plugin install review-toolkit@humanity-plus
```

```bash
claude plugin install code-publish@humanity-plus
```

(Inside a session: `/plugin marketplace add Humanity-Plus/commons`, then
`/plugin install <name>@humanity-plus`.) Plugin skills are namespaced, invoke
them as `/review-toolkit:review-pr`, `/code-publish:create-pr`, and so on.
Update later with `claude plugin marketplace update humanity-plus`. The design
systems skills are CLI-only for now.

> **Installing review skills with the CLI? Use `-g` (global).** Review skills
> installed into a project you then review other people's PRs in can be swapped
> out by a malicious PR checkout, the
> [security model](skills/code-reviews/skills/review-pr/README.md#security--the-diff-is-untrusted-input)
> explains why. The plugin lane is always global, so it's safe by default.

## Skills

### The Review Toolkit

An AI code-review loop for pull requests and branches. Point it at a PR, a branch,
or your current work, and it reviews the change from several independent angles at
once, hunting bugs, missing tests, risky new dependencies, deploy hazards, and
violations of your repo's own written conventions, and checking that the diff
actually does what the PR description claims. Every finding is then re-examined by
a skeptic pass so false positives are killed before you see them, severities are
weighed against the whole review, and the result lands as a self-contained HTML
report with evidence, suggested fixes, and clickable `file:line` links. Companion
skills close the loop: fix the verified findings on your own branch, review and fix
in one pass before opening a PR, publish the review to GitHub as inline comments,
or file the leftover nitpicks as tracked issues so they get fixed later instead of
dying with the report.

**[Read the full guide](https://htmlpreview.github.io/?https://github.com/Humanity-Plus/commons/blob/main/skills/code-reviews/review-toolkit.html)**
([source](skills/code-reviews/review-toolkit.html)), setup, how a review runs, and
a reference for every skill.

| Skill | What it does |
|---|---|
| [review-pr](skills/code-reviews/skills/review-pr/SKILL.md) | The reviewer: full multi-angle review ending in an HTML report. Report-only, never edits code. |
| [resolve-review](skills/code-reviews/skills/resolve-review/SKILL.md) | The fixer: applies scoped fixes for a review's findings on your own branch, validates each one, and reports what changed. |
| [review-fix](skills/code-reviews/skills/review-fix/SKILL.md) | Review + fix in one pass, results in chat, no HTML. The fast loop before opening a PR, and the thing to point agents at. |
| [publish-review](skills/code-reviews/skills/publish-review/SKILL.md) | Posts a finished review to the GitHub PR as one real review with inline comments. Always dry-runs and confirms first. |
| [review-issues](skills/code-reviews/skills/review-issues/SKILL.md) | Files a review's non-blocking nitpicks as grouped, deduplicated GitHub issues for a scheduled fixer to drain. |
| [map-primitives](skills/code-reviews/skills/map-primitives/SKILL.md) | Maps your system's building blocks into `docs/primitives.md` + `primitives.yaml`, the config the review uses to spot when a change re-invents an existing shape. |

**Make it yours.** The toolkit works out of the box, but its real configuration is
three repo-owned files: a `REVIEW.md` with the facts a diff can't tell a reviewer,
written convention docs the review cites rule-by-rule, and a `primitives.yaml` map
of your system's building blocks. All three can be drafted by an agent, then
**review and curate them yourself**; they're trusted context, and a wrong line
suppresses real findings. The
[guide's configuration section](https://htmlpreview.github.io/?https://github.com/Humanity-Plus/commons/blob/main/skills/code-reviews/review-toolkit.html#configure)
walks through each file.

Requires [bun](https://bun.sh) to render the HTML report, and the
[GitHub CLI](https://cli.github.com) for PR mode and publishing (local-branch
review works without it). The toolkit also ships a
[Claude Code hook](skills/code-reviews/hooks/README.md) that blocks `gh pr create`
until a fresh review has run against the code being PR'd.

### Code publish

Three skills for the moment work leaves your machine and lands on GitHub. They
share one philosophy: **disclose who wrote it, and make what was written easy to
read** — the opposite of skills that try to make agent output pass as human.
Also installable as the `code-publish` plugin
([bundle README](skills/code-publish/README.md)).

**[write-clearly](skills/code-publish/skills/write-clearly/SKILL.md)**
Clarity rules for prose deliverables — PR bodies, issue text, docs, reports.
Cuts filler and hedging, names sources, prefers mechanism or number over vibes.

**[create-pr](skills/code-publish/skills/create-pr/SKILL.md)**
Opens or updates a pull request with an outcome-led title in the repo's own
convention and a problem-first description a reviewer can understand without
reconstructing the motivation from the diff.

**[github-comment-attribution](skills/code-publish/skills/github-comment-attribution/SKILL.md)**
Prepends a one-line attribution header to agent-authored GitHub comments, issues,
and replies so humans and agents can tell them apart from the account owner's own
words.

### Design systems

**[naming-tokens](skills/design-systems/naming-tokens/SKILL.md)**
Names and structures design tokens across primitive, semantic, and component layers
so names stay clear, stable, and maintainable as the system grows.

## License

[MIT](LICENSE)
