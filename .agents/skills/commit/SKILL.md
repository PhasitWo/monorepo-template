---
name: commit
description: Generate a conventional commit message from staged (or unstaged) git changes, show it to the user for approval, then commit with a Co-Authored-By trailer.
---

Generate a conventional commit message from staged (or unstaged) git changes, show it to the user for approval, then commit with a Co-Authored-By trailer.

**Arguments** — the text the user typed after the skill name (`/commit …` in Claude Code, `$commit …` in Codex). Claude Code appends it to this file as an `ARGUMENTS:` line; in Codex, read it from the user's message. No text after the skill name means the arguments are empty.

## Step 1: Inspect the changes

Run these commands:

```bash
git status
git diff --staged
```

If `git diff --staged` produces no output (nothing staged), also run:

```bash
git diff
```

If there's nothing to commit at all, tell the user and stop.

## Step 2: Write the commit message

Analyze the diff and write a **conventional commit message**:

- Format: `type(scope): short description`
- Common types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`
- Scope is optional — use it when it adds clarity (e.g., `fix(auth):`)
- Description: lowercase, imperative mood, no trailing period, under 72 chars
- Focus on **why/what**, not which files changed
- Add a short body (bullet points) only if there are secondary concerns worth noting
- Append `[skip ci]` to the subject for docs/chore-only commits that should not trigger a deploy

If arguments are provided, use them as the commit message directly and skip generation.

Show the message to the user and wait for approval (or edits) before committing.

## Step 3: Stage and commit

If nothing was staged, stage everything first:

```bash
git add -A
```

Then commit with the approved message and a Co-Authored-By trailer naming the model you are running on. If your
environment supplies its own attribution line, use that one verbatim instead.

```bash
git commit -m "$(cat <<'EOF'
<approved message>

Co-Authored-By: <model name> <noreply@anthropic.com>
EOF
)"
```

Report the commit hash and summary.

## Rules

- Never use `--no-verify` unless the user explicitly asks.
- If a pre-commit hook fails, report the error and ask how to proceed — don't retry blindly.
