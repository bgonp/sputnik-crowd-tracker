#!/usr/bin/env bash
# Block Write/Edit/NotebookEdit calls that target the main checkout.
# Edits must land inside .claude/worktrees/<branch>/ to pass through.
# Paths outside the project (tmp, ~/.claude, scratchpad) are always allowed.

set -euo pipefail

f=$(jq -r '.tool_input.file_path // empty')

# Not a file-path tool — pass through
[ -z "$f" ] && exit 0

# Temp / scratchpad — always OK
[[ "$f" == /tmp/* || "$f" == /private/tmp/* ]] && exit 0

# User-level Claude memory — always OK
[[ "$f" == "$HOME/.claude/"* ]] && exit 0

# Derive project root from git; if that fails, don't block
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

# File is outside the project — not our concern
[[ "$f" != "$root/"* ]] && exit 0

# .claude/ itself (settings, hooks, worktrees) — OK
[[ "$f" == "$root/.claude/"* ]] && exit 0

# Everything else is the main checkout → deny
printf '%s' '{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Direct edits to the main checkout are blocked by project policy.\nCreate a worktree first:\n  git worktree add .claude/worktrees/<branch> -b <branch>\nThen run all edits from inside that path."
  }
}'
