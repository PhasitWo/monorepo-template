---
name: spec-analysis
description: Interrogate a rough idea until its requirements are clear enough to write a spec. Runs locally and interactively — interactive multiple-choice Q&A when supported, plain-text otherwise.
disable-model-invocation: true
---

Interrogate a rough idea until its requirements are clear enough to write a spec. Runs locally and interactively — interactive multiple-choice Q&A when supported, plain-text otherwise.

**Arguments** — the text the user typed after the skill name (`/spec-analysis …` in Claude Code, `$spec-analysis …` in Codex). Claude Code appends it to this file as an `ARGUMENTS:` line; in Codex, read it from the user's message. No text after the skill name means the arguments are empty.

**This command never creates specs and never writes files.** When requirements are clear, it prints a requirements brief and tells you to run `/spec-create`.

---

## Usage

```
/spec-analysis "<rough idea, paste of a PRD, or a bug description>"
/spec-analysis docs/specs/<file>.md     # interrogate an existing draft spec
```

If the arguments are empty, ask the user what they want analysed before doing anything else.

---

1. **Announce yourself.** Print a greeting that naturally mentions the model you are running on and that you are in Spec Analysis mode. Do not use static text — speak in your own voice.

2. **Load the input:**
   - If the arguments are a path to an existing file, read it and treat its contents as the requirements under analysis.
   - Otherwise treat the arguments as the raw description.

3. **Classify the work** so your questions are aimed correctly. Pick exactly one and state it in the brief:
   - `Bug` — something is broken or regressing vs. expected behavior
   - `Feature` — new user-facing capability
   - `Task` — everything else (chore, refactor, infra, docs, deps)

4. **Read the codebase before asking anything.** Review ALL project coding skills at @.agents/skills/\*/SKILL.md, then look at the actual files the change would touch. Questions that the repo already answers are noise — answer them yourself and say so.

5. **Interrogate.** Think like a developer receiving a PRD — do not guess or assume. Identify every ambiguity, missing detail, undefined edge case, and unclear requirement, then work through them with the user:

   a. Ask the highest-leverage unanswered question. Ask one at a time unless several are trivially related — batch those together.
   b. Record the answer.
   c. Add any follow-up questions the answer raises to the pending list.
   d. Repeat until zero open questions remain.

   **How to ask:** If your environment provides an interactive multiple-choice question tool (e.g. `AskUserQuestion`), use it for every question that has a small set of concrete options — put your recommended option first and mark it "(Recommended)", and batch up to 4 related questions in one call. Fall back to plain-text Q&A only for genuinely open-ended questions or when no such tool is available. If the user dismisses the prompt, stop and wait for their next instruction.

   Cover at minimum: scope boundaries (what is explicitly out), affected files and modules, data/contract changes, error and edge-case behavior, backwards compatibility, and how the result will be verified.

   **Repo scope.** Part of clarifying requirements is establishing which repositories the work touches. If the change plausibly reaches beyond this one (it touches a shared contract, an API other services consume, or the user mentions another service), say so and ask the user to confirm the full set. Requirements are not "clear" until that set — including "this repo only" — has been stated out loud.

6. **When everything is resolved**, print the requirements brief:

```
## Requirements brief — <short title>

**Type:** Bug | Feature | Task
**Repos in scope:** <this repo only | list>

### Resolved
- <question> → <answer>
- ...

### Assumptions I made
- <anything you answered from the codebase rather than asking>

### Suggested next step
/spec-create "<suggested kebab-friendly spec name>"
```

7. If the user stops before every question is answered, print the brief anyway with an **### Still open** section listing what remains, so nothing is lost.

> **Important:** This command never writes a spec file and never implements anything. Creating the spec is `/spec-create`; implementing it is `/spec-run`.
