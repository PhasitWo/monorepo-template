---
name: prd
description: Use after meaningfully changing a product feature — adding/removing backend routes, controllers, or services; changing service behavior (validation, uniqueness, numbering, status rules, side effects); adding/removing Prisma models, columns, or enum values that affect product behavior; changing `@repo/shared` DTOs; adding/removing frontend pages or user flows; changing auth or access rules; or after a new dated spec lands under `docs/specs/`. Keeps the matching PRD in `docs/prd/` in sync with the implementation. PRDs are written for a business audience — update product behavior, not implementation detail.
---

# PRD maintenance

Keep the Product Requirement Documents under `docs/prd/` in sync with the codebase whenever a feature changes. PRDs
are the **product-side description** of each feature area — they tell a business reader (owner, operator,
stakeholder) what the feature does, who uses it, and how it behaves. They are not API documentation (that's the
Swagger UI generated from the Zod route schemas) and not data shapes (that's `packages/shared/src/dto/` and
`apps/backend/prisma/schema.prisma`).

## When to use

You just did one of:

- Added, removed, or renamed a route in `apps/backend/src/routes/<domain>.routes.ts` that changes what a
  user can do.
- Added, removed, or changed the behavior of a service in `apps/backend/src/services/<domain>.service.ts` that a
  PRD describes (e.g. duplicate-name checks, running-code format, status transitions, what a delete also removes).
- Changed how a service normalises input (trimming, defaults, blank → empty) in a way users notice.
- Added or removed a Prisma model, an enum value, or a column that affects user-visible behavior.
- Changed a `@repo/shared` DTO in `packages/shared/src/dto/` so users can enter or see different data, or added an
  `ERROR_CODE` users will see.
- Changed auth or access rules — `authMiddleware.ts`, the login / refresh-token flow, which routes are public vs
  authenticated, or (if added) tenant scoping.
- Added or removed a frontend page or flow in `apps/frontend/src/pages/` or a route in `apps/frontend/src/App.tsx`.
- Changed what the audit log records (`services/auditLog.service.ts`, `AuditAction` / `AuditEntityType`).
- Landed a new dated spec under `docs/specs/` for a feature area covered by an existing PRD.
- Changed a default users would notice (page size, session length, code format).

Skip this skill for purely-internal refactors that don't change product behavior (renaming helpers,
query/unit-of-work plumbing, splitting a service, tightening types, test-only changes). If a spec's
Non-goals says "PRD updates — no product behaviour changes", skip it.

## Instructions

1. **Find the right PRD.** Use the routing table below to map your change to a PRD. If the change spans two PRDs,
   update both. If the change is for a feature area not yet covered, add a new PRD (see _Adding a new PRD_).
2. **If the PRD file doesn't exist yet**, create it from the 12-section skeleton, filling every section from the
   current code (not just the change you made), and add it to `docs/prd/README.md`.
3. **Read the existing PRD.** Skim all 12 sections so you know where the change belongs.
4. **Update the matching sections** — most changes affect _Functional Requirements_, _Key Workflows_, or
   _Integrations & Side Effects_. Less often: _Non-Functional Requirements_ (auth, access, audit, performance),
   _Out of Scope_, or _Open Questions_.
5. **Add the new spec to the References section** if a new dated spec under `docs/specs/` drove the change.
6. **Cross-link** to other PRDs when the change ripples (e.g. a new entity that the audit log must now record).
7. **Update the index** in `docs/prd/README.md` if you added a new PRD or changed a one-line summary, and the
   _Shared conventions_ table there if a convention changed (e.g. default page size).
8. **Stay business-flavored.** No Prisma column names in user-facing prose, no curl examples, no TypeScript types in
   section bodies. Implementation details belong in the References section at the bottom.

## Feature-area routing (which PRD to update)

Paths are relative to the repo root. `be/` = `apps/backend/src/`, `fe/` = `apps/frontend/src/`,
`shared/` = `packages/shared/src/dto/`.

| Code change touches                                                                                                                                                                                                                                                                       | PRD to update                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `be/routes/auth.routes.ts`, `be/controllers/auth.controller.ts`, `be/services/auth.service.ts`, `be/middlewares/authMiddleware.ts`, `RefreshToken` model, `shared/auth/`, `fe/pages/login.tsx`, `fe/api/auth.ts`, `fe/api/service.ts` token refresh, `fe/contexts/app-state-provider.tsx` | [01 — Authentication & Sessions](../../../docs/prd/01-auth-and-sessions.md) |
| `be/{routes,controllers,services}/user.*.ts`, `User` model, `shared/user/`, `fe/pages/user/`, `fe/api/user.ts`, `seed.ts` (first account)                                                                                                                                                 | [02 — Users](../../../docs/prd/02-users.md)                                 |
| `be/{routes,controllers,services}/tag.*.ts`, `Tag` model, `shared/tag/`, `fe/pages/tag/`, `fe/api/tag.ts`                                                                                                                                                                                 | [03 — Tags (example domain)](../../../docs/prd/03-tags.md)                  |
| `be/{routes,controllers,services}/auditLog.*.ts`, `be/common/utils/computeDiff.ts`, `AuditLog` model, `AuditAction` / `AuditEntityType` enums, `shared/audit-log/`, `fe/pages/audit-log/`, any service that starts or stops writing audit rows                                            | [04 — Audit Activity Log](../../../docs/prd/04-audit-activity-log.md)       |

Cross-cutting ripples to watch for:

- A new auditable entity or action → update the entity's PRD **and** PRD-04.
- A new feature area → new PRD (see below) **and** a routing row here.
- A change to who can do what (auth, roles, tenant scoping) → the affected PRDs' section 7 **and** PRD-01.

> When you build on this template, replace the Tags row with your real domains as you add them, and delete
> PRD-03 together with the example domain.

## PRD section structure (must be preserved)

Every PRD uses these 12 sections, numbered, in this order. Don't reorder; don't drop.

1. Overview
2. Goals
3. Non-Goals
4. Personas
5. User Stories
6. Functional Requirements
7. Non-Functional Requirements
8. Key Workflows
9. Integrations & Side Effects
10. Out of Scope
11. Open Questions
12. References

## Where each kind of change lands

| Kind of change                                                    | Section(s) to edit                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| New capability the user can perform                               | 5 (story) + 6 (functional req) + 8 (workflow)                                      |
| Behavior change of an existing capability                         | 6 (functional req) + 8 (workflow if the journey changes)                           |
| New side effect (audit row, generated code, notification, export) | 9 (integrations & side effects) + maybe 8                                          |
| New auth / access gate                                            | 7 (non-functional) + 6 (under the relevant capability)                             |
| New configuration knob with a default                             | 6 or 7 depending on whether it's user-visible                                      |
| Capability removed                                                | Delete from 5/6/8; consider adding to 10 (out of scope) with a note on why         |
| Open question resolved                                            | Move from 11 (open) into 6/8 as a stated requirement                               |
| New dated spec under `docs/specs/`                                | 12 (references) — add bullet; update 6/8 if the spec changed behavior              |
| Cross-feature change (e.g. a field shown in two feature areas)    | Update **both** PRDs (the originator and the consumer) and cross-link in section 9 |

## Style rules for PRD prose

- **Audience is business.** Avoid column names (`runningCode`, `deletedAt`), enum constants
  (`AuditAction.LOGIN_FAILURE`), class names (`TagService`), and curl/JSON snippets in the main body. Use plain
  language ("the tag code", "deleted", "failed sign-in").
- **Code identifiers belong in References (12).** It's fine — and useful — to list routes, services, models, DTOs,
  and frontend pages there.
- **Tables for shape, prose for behavior.** Use tables for personas, record fields, lifecycle states (e.g. active →
  inactive); prose for workflows and reasoning.
- **Cross-link instead of duplicating.** If a behavior is owned by another PRD, link to it; do not restate the rules.
  Conventions shared by every feature (pagination, audit, codes) live once in `docs/prd/README.md`.
- **Keep Out-of-Scope (10) explicit.** When you decline to do something, say so — protects against scope creep
  later. Specs' _Non-goals_ are a good source.
- **Open Questions (11)** is for product/stakeholder input that affects future behavior. It is _not_ a TODO list for
  the engineer.
- Write the PRD in the project's documentation language; quote user-visible UI text verbatim when it matters to
  behavior (e.g. an error message).

## Adding a new PRD

If a brand-new feature area lands that doesn't fit into any PRD above:

1. Pick the next free number (`05-…`).
2. Copy the 12-section skeleton from any existing PRD.
3. Fill in all sections — leave none blank; if a section is empty, say "None at this time."
4. Add a row to the index table in `docs/prd/README.md`.
5. Add a routing line to the **Feature-area routing** table above so future agents know where to direct similar
   changes.

## Removing a PRD

Don't delete a PRD even if every capability inside it has been retired (exception: the template's example-domain
PRD, which you delete together with the example code). Instead:

1. Update the relevant sections (especially 10 — Out of Scope) to record that the feature is sunset.
2. Add a banner at the top of the PRD: `> **Status:** Deprecated as of YYYY-MM. Kept for historical reference.`
3. Keep the entry in the README index with a `(deprecated)` suffix.

## Validation

Before considering the PRD update complete:

- The 12-section structure is intact.
- The References section lists the new spec / source files.
- Cross-linked PRDs have been updated where applicable.
- `docs/prd/README.md` is in step (one-line summary and shared conventions still correct).
- No code-level identifiers leaked into sections 1–11 except where unavoidable.
- `npm run format` has been run (Prettier covers `**/*.md`).
