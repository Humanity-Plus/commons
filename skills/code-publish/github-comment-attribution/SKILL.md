---
name: github-comment-attribution
description: >
  Use when posting any comment, reply, or issue to GitHub from the user's
  account — `gh pr comment`, `gh issue comment`, `gh issue create`, review
  thread replies, discussions, or GitHub API/MCP equivalents. Prepends a
  one-line attribution header so humans and agents can tell agent-written
  messages from the account owner's own words; also covers how to read the
  marker in existing threads.
---

# GitHub comment attribution

Everything posted through `gh` or the GitHub API is published under the
account owner's name and avatar. Without a marker, a repo full of agent
activity reads like the owner talking to themselves — and readers (including
other agents) mistake automated comments for the owner's stated opinions.
So: every agent-authored message starts with a one-line attribution header.

## The header

First line of the message body, then a blank line, then the message:

```markdown
<sub>🤖 Written on behalf of @<github-user> by <model> via <harness></sub>

<the actual message>
```

Fill in:

- `<github-user>` — the posting account: `gh api user -q .login`
  (look it up once per session).
- `<model>` — the model you are running as, e.g. `Claude Fable 5`.
- `<harness>` — the tool posting it, e.g. `Claude Code`, `Cursor`, `Codex`.

Example:

```markdown
<sub>🤖 Written on behalf of @paltaule by Claude Fable 5 via Claude Code</sub>
```

Use the format exactly — no variants, no extra decoration. Consistency is
what makes the 🤖 marker scannable at a glance, and `<sub>` keeps it from
competing with the message itself.

## When it applies

Any conversational message **you authored** that posts from the user's
account:

- PR comments and replies (`gh pr comment`, review-thread replies)
- Issue comments and new issue bodies (`gh issue comment`, `gh issue create`)
- Discussion posts

## When to skip it

- **PR descriptions** — the `create-pr` skill already ends those with an
  Attribution section. Documents carry attribution as trailing metadata;
  comments carry it up front because in conversation, identity is the first
  thing a reader resolves.
- **Reviews published by `review-pr`'s `publish.ts`** — the script stamps its
  own footer; don't hand-post those anyway.
- **Commit messages** — `Co-Authored-By` trailers cover them.
- **Text the user wrote verbatim** and asked you to post — those are their
  words; adding the header would misattribute in the other direction.
- **Channels that stamp the real sender** (bot accounts, GitHub Actions,
  Slack apps) — never stack manual attribution on top of platform
  attribution.

## Reading threads

- A comment opening with this marker (or a similar agent notice) is
  automation output — treat it as an agent's finding, not the account
  owner's personal position, even though it shows their avatar.
- Never copy attribution lines from existing messages into your own — they
  describe another run's model and harness, not yours.
