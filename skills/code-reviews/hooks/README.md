# Hooks — deterministic gates for the review toolkit

Instruction files (`AGENTS.md`) are advisory: an agent deep into a long session can
drift past them. Claude Code **hooks** are executed by the harness, so the agent
*cannot* skip them. This directory ships ready-to-use hooks that enforce the review
loop.

## require-review-before-pr.sh

Blocks `gh pr create` until `review-report/findings.json` exists **and is newer than
the last commit** — meaning a `review-pr` run actually covered the code being PR'd.
On block, the agent is told to run `/review-fix` (review findings-only → fix →
re-report) and try again. All other commands pass through untouched.

### Install (per project)

Copy the script into the project and register it in the project's
`.claude/settings.json`:

```sh
mkdir -p .claude/hooks
curl -fsSL https://raw.githubusercontent.com/Humanity-Plus/commons/main/skills/code-reviews/hooks/require-review-before-pr.sh \
  -o .claude/hooks/require-review-before-pr.sh
chmod +x .claude/hooks/require-review-before-pr.sh
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/require-review-before-pr.sh"
          }
        ]
      }
    ]
  }
}
```

### Install (everywhere)

To enforce the gate in **every** repo you work in, save the script somewhere stable
(e.g. `~/.claude/hooks/`, or a clone of this repo) and register it in
`~/.claude/settings.json` instead:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/require-review-before-pr.sh"
          }
        ]
      }
    ]
  }
}
```

### Notes & limits

- **Exit contract:** exit `0` allows the call; exit `2` blocks it and feeds stderr
  back to the agent as guidance. That's the whole protocol.
- **Freshness check, not quality check.** The hook proves a review ran against the
  latest commit; it does not read the findings. Whether remaining findings are
  acceptable is the agent's (and your) judgment — that policy lives in `AGENTS.md`.
- **Cloud routines:** hooks only fire where they're configured. A scheduled cloud
  agent enforces this only if its environment carries the settings + script;
  otherwise put the instruction in the routine's prompt ("run `/review-fix` before
  filing the PR") — the prompt is the reliable channel there.
- **Cursor:** Cursor doesn't execute Claude Code hooks; rely on the `AGENTS.md` rule
  there.
- `jq` is used when available to parse the hook payload precisely; without it the
  script falls back to matching the raw payload, which is coarser but still catches
  `gh pr create`.
