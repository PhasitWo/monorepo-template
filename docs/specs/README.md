# Specs

Dated implementation specs, one per change: `YYYYMMDD-HHmm-<kebab-name>.md` (e.g. `20260926-1430-user-roles.md`).

- Create one with `/spec-create "<name>"` (or `/spec-analysis` first to clarify a rough idea).
- Run one with `/spec-run docs/specs/<file>.md` — it implements the spec on `feat/<name>` (or `fix/<name>`) and
  commits locally.
- Once a spec changes product behavior, the matching PRD in `docs/prd/` links to it from its _References_ section.
