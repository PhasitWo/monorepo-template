---
name: spec-run
description: Execute a spec on a feature branch and leave the work committed locally. Runs locally and interactively.
disable-model-invocation: true
---

Execute a spec on a feature branch and leave the work committed locally. Runs locally and interactively.

**Arguments** — the text the user typed after the skill name (`/spec-run …` in Claude Code, `$spec-run …` in Codex). Claude Code appends it to this file as an `ARGUMENTS:` line; in Codex, read it from the user's message. No text after the skill name means the arguments are empty.

The arguments are a spec file path (e.g. `docs/specs/20260421-1809-my-feature.md`). If they are empty, list the specs in `docs/specs/` and ask the user which one to run — never pick one on their behalf.

**This command stops at a local commit.** It does not push and does not open a pull request. When the user is ready for that, they run `/pr`.

---

1. **Announce yourself.** Print a greeting that naturally mentions the model you are running on and that you are in Spec Run mode. Do not use static text — speak in your own voice.

2. **Load the spec.** Read the file at the given path. If it does not exist, say so and stop.

3. **Strict-mode check.** Parse the "Missing / Open questions" section and collect every bullet not in `- <question> → <answer>` format. If any remain, enter the Q&A loop (same as `/spec-create` step 7) to resolve them with the user, rewrite the section with `- <q> → <a>` pairs, save the file, and re-read it before proceeding. Do not start implementing with open questions outstanding.

4. **Check the working tree is clean:**

   ```bash
   git status --porcelain
   ```

   If there are uncommitted changes, show them and ask the user how to proceed (commit, stash, or abort) before touching branches.

5. **Switch to main and pull latest:**

   ```bash
   git checkout main && git pull
   ```

6. **Derive the branch name** by stripping the datetime prefix (`YYYYMMdd-HHmm-`) and the `.md` extension from the spec filename, e.g. `docs/specs/20260318-1430-draggable-assignment-dates.md` → `feat/draggable-assignment-dates`. Use a `fix/` prefix instead if the spec is plainly a bug fix.

7. **Create and switch to the branch:**

   ```bash
   git checkout -b <branch-name>
   ```

   If the branch already exists, check it out and rebase it on `main` rather than failing.

8. **Consult ALL project skills** at @.agents/skills/\*/SKILL.md. Follow their conventions throughout implementation. Only write custom code for concerns no skill addresses. Carry out the full spec.

9. **Improve test coverage** for files touched. Aim for 100%; skip only genuinely untestable lines with `/* c8 ignore */` comments.

10. **Run the project's checks** — the pre-commit list in `AGENTS.md` (re-read `package.json` if it changed — do not invent a script):

    ```bash
    npm run format
    npm run lint
    npm run build
    npm test -w @app/backend
    ```

    Add `npm run test:integration -w @app/backend` (needs Docker) when the spec touches SQL, locking, running numbers or unique constraints.

    - Failures caused by this spec's changes → fix and re-run.
    - Pre-existing failures unrelated to this spec → stop and tell the user: "These were already failing before this change. Please fix them before I commit." Do not commit on top of a red suite unless the user says to.

11. **Commit.** Stage the spec file alongside the implementation and write the message following @.agents/skills/commit/SKILL.md conventions:

    ```bash
    git add <changed files> <spec-file>
    git commit -m "<conventional commit message>"
    ```

    Keep it to one commit unless the spec's changes are genuinely separable — in that case, split them into logically distinct commits.

12. **Report:**
    - the branch name and the commit SHA(s)
    - a short summary of what was implemented, section by section against the spec's Goals
    - the test/lint result
    - anything in the spec you deliberately did not do, and why
    - the next step: `/pr` to open a pull request when they are ready
