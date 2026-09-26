---
name: pr
description: Create a pull request for the current changes.
disable-model-invocation: true
---

Create a pull request for the current changes.

**Arguments** — the text the user typed after the skill name (`/pr …` in Claude Code, `$pr …` in Codex). Claude Code appends it to this file as an `ARGUMENTS:` line; in Codex, read it from the user's message. No text after the skill name means the arguments are empty.

## Cross-repo mode (optional)

By default this command opens the PR in the repository that the workspace is checked out in (same-repo). A caller (e.g. `/spec-run`) may instead provide one or more **target repos** — passed in the arguments, derived from `cross-repo: <repo>` labels on the issue, or stated in the spec/issue context (e.g. "open the PR on `<owner>/<other-repo>`"). When target repos are present, repeat the steps below once per target `<owner>/<repo>`:

- The target repo must be cloned into the workspace first: `gh repo clone <owner>/<repo> ./.cross-repo-target/<repo>` (a CI workflow may have done this already).
- Make the file changes, commit, and push the branch **inside that clone** (`cd ./.cross-repo-target/<repo>`), and create the PR with `gh pr create --repo <owner>/<repo>`.
- The minted token must be scoped to the target repo (`contents: write` + `pull-requests: write`). If `gh api repos/<owner>/<repo>` returns `404`, the token cannot reach that target — stop and report instead of opening the PR in the wrong repo.

When **no** target repo is provided, follow every step below exactly as written against the current repo — same-repo behavior is unchanged.

1. **Announce yourself.** Print a greeting that naturally mentions the model you are running on and that you are in PR mode. Do not use static text — speak in your own voice.
2. Run this script to gather current state:

```bash
echo "=== BRANCH ==="
git branch --show-current

echo "=== STATUS ==="
git status --short

echo "=== DIFF STAT ==="
git diff --stat
git diff --staged --stat
```

3. **Handle branch:**
   - If on `main` or `master`:
     - If arguments are provided, use them as the branch name directly.
     - Otherwise, derive a descriptive branch name from the changes and ask the user to confirm.
     - Run: `git checkout -b <branch-name>`
   - If on a feature branch that already has uncommitted changes, stay on it.

4. **Stage & commit** any uncommitted changes using @.agents/skills/commit/SKILL.md (skip if working tree is clean).
   - **Cross-repo:** run these git steps inside `./.cross-repo-target/<repo>` (the target clone). The branch is pushed to the target's `origin`, not this repo.

5. Run this script to push and collect PR context in one shot:

```bash
BRANCH=$(git branch --show-current)

echo "=== PUSH ==="
git push -u origin "$BRANCH" 2>&1

echo "=== DIFF VS MAIN ==="
git diff main...HEAD --stat

echo "=== LOG VS MAIN ==="
git log main..HEAD --oneline

echo "=== SPEC FILE ==="
SPEC_PART=$(echo "$BRANCH" | sed 's|^[^/]*/||')
find docs/specs/ -name "*${SPEC_PART}*" -type f 2>/dev/null | head -1
```

6. If a spec file was found, read it to inform the PR description.

7. Create the PR with `gh pr create` (cross-repo: add `--repo <owner>/<repo>` so the PR opens in the target repo):

```
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary

- <bullet summarising what was done>

## Test plan

- [ ] <test case from spec or key scenario>
- [ ] <another test case>
- [ ] No regressions in existing functionality

<Closes #n line — include only when an issue number was passed in via /spec-run or the caller>

🤖 _<your model name> via <your coding agent>_
EOF
)"
```

- Title: short, imperative, under 70 chars (use the spec title if available)
- Summary: 2–4 bullets covering what changed and why
- Test plan: pull from the spec's "Test cases" section if available, otherwise write key scenarios
- `Closes #<n>`: include on its own line when an issue number is provided by the caller (e.g. `/spec-run --from-issue <n>`). This must be the exact keyword form on its own line for GitHub to auto-close the issue on merge.

8. Report the PR URL.
