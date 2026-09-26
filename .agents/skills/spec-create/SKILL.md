---
name: spec-create
description: Create or refine a spec file under `docs/specs/`. Runs locally and interactively — Q&A with the user (interactive multiple-choice when supported, plain-text otherwise), no network state to manage.
disable-model-invocation: true
---

Create or refine a spec file under `docs/specs/`. Runs locally and interactively — Q&A with the user (interactive multiple-choice when supported, plain-text otherwise), no network state to manage.

**Arguments** — the text the user typed after the skill name (`/spec-create …` in Claude Code, `$spec-create …` in Codex). Claude Code appends it to this file as an `ARGUMENTS:` line; in Codex, read it from the user's message. No text after the skill name means the arguments are empty.

Two modes, detected from the arguments:

- **Create**: the arguments are a spec name (e.g. `"user invitations"`) — draft a new spec file.
- **Refine**: the arguments are a path to an existing spec (e.g. `docs/specs/20260421-1809-my-feature.md`) — revise that file in place.

If the arguments are empty, ask the user for a spec name first.

---

## Create mode (arguments = spec name)

1. **Announce yourself.** Print a greeting that naturally mentions the model you are running on and that you are in Spec Create mode. Do not use static text — speak in your own voice.
2. Get the current date and time: `date +%Y%m%d-%H%M`
3. Convert the spec name to kebab-case (lowercase, spaces to hyphens).
4. Create the file at `docs/specs/<YYYYMMdd-HHmm>-<spec-name>.md` with this template:

```markdown
# <Spec Name>

## Overview

<!-- What is this spec about? -->

## Goals

-

## Non-goals

-

## Proposal

<!-- Describe the solution -->

## Files

<!-- Files to edit or create. For large projects with many new files, show directory structure instead. -->

- `path/to/file.ts` — what to change or create and why

## Constraints

<!-- Technical, UX, or business constraints that must be respected -->

-

## Missing / Open questions

<!-- What information is still needed before implementation can start? -->

-

## Test cases

<!-- Key scenarios that must work correctly -->

- [ ]
- [ ]

## Definition of Done

- [ ] All goals are implemented
- [ ] All test cases pass manually
- [ ] No regressions in existing functionality
- [ ] Changes committed on a feature branch
```

5. Before analysing the spec, review ALL project coding skills at @.agents/skills/\*/SKILL.md to understand existing conventions. Use knowledge from these skills to seed more informed questions in the "Missing / Open questions" section.
6. After creating the file, analyse its content and identify any missing information or ambiguities. Seed the "Missing / Open questions" section with those questions. Also seed the "Files" section with concrete file paths — for each file, note whether it needs to be edited or created and briefly describe what changes are needed. If the spec involves creating many new files, show a directory tree instead.

   If the user already ran `/spec-analysis` and pasted its requirements brief, use those `question → answer` pairs directly instead of re-asking them.

7. Enter a Q&A loop to resolve every open question before finishing:
   a. Ask the user the first unanswered question.
   b. Record the answer.
   c. Determine if any follow-up questions arise — if so, add them to the pending list.
   d. Repeat until zero open questions remain.
   - **How to ask:** If your environment provides an interactive multiple-choice question tool (e.g. `AskUserQuestion`), use it for every question that has a small set of concrete options — put your recommended option first and mark it "(Recommended)", and batch up to 4 related questions in one call. Fall back to plain-text Q&A only for genuinely open-ended questions or when no such tool is available. If the user dismisses the prompt, stop and wait for their next instruction.
   - Once all questions are resolved, rewrite the "Missing / Open questions" section: `- <question> → <answer>`. Fill in/refine other sections using the answers.
8. Report the final file path and a short summary of what was clarified.
9. **IMPORTANT: This command only creates the spec file. Do NOT execute or implement the spec. Do NOT create branches, write code, or commit. If the user wants to execute the spec, they should use `/spec-run`.**

---

## Refine mode (arguments = existing spec path)

Use this when a spec already exists and the user wants it changed — after review feedback, a scope change, or new information.

1. **Announce yourself** as above, noting that you are refining an existing spec.
2. Read the spec file at the given path. If it does not exist, say so and stop — do not silently create a new one.
3. Review ALL project coding skills at @.agents/skills/\*/SKILL.md.
4. **Collect the feedback.** Use whatever the user passed along with the path or said in the conversation. If they gave no direction, ask what they want changed and stop until they answer.
5. **Ambiguity check.** If a feedback item cannot be turned into a concrete change (e.g. "I don't like item 3" without saying what it should be instead), ask about exactly those points before editing. Do not guess.
6. **Apply the changes in place.** Start from the existing content and change only what the feedback calls for — do not rewrite sections it does not touch. Preserve the existing `- <question> → <answer>` pairs in "Missing / Open questions"; append new pairs only for genuinely new clarifications. Keep the filename and its datetime prefix unchanged so `/spec-run` still derives the same branch name.
7. Report the file path and a diff-style summary of what changed: which sections were touched and why.
