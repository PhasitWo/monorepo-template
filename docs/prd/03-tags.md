# PRD-03 — Tags (example domain)

> This is the template's example feature. It exists to show every layer of the stack end to end. Replace it with your
> first real feature, or delete it (code, migration, page and this PRD) once you no longer need the reference.

## 1. Overview

A tag is a named label with an optional description. Each tag gets a readable code when it is created. Tags that are no
longer used are switched inactive rather than deleted, so anything that already refers to them keeps its history.

## 2. Goals

- Let operators maintain a clean, de-duplicated list of labels.
- Give every label a short, stable code that people can quote.

## 3. Non-Goals

- Attaching tags to other records (no other feature uses tags yet).
- Tag hierarchies, colours or icons.

## 4. Personas

| Persona  | Needs                                               |
| -------- | --------------------------------------------------- |
| Operator | Create, rename, describe and retire labels quickly. |

## 5. User Stories

- As an operator, I add a tag with a name and an optional description.
- As an operator, I rename a tag or change its description.
- As an operator, I switch a tag inactive (or back to active) straight from the list.
- As an operator, I search tags by name and filter the list by code, name, created date or status.

## 6. Functional Requirements

| Field       | Rules                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| Code        | `T` + 6 digits (`T000001`), assigned on creation in sequence. Never changes.        |
| Name        | Required, up to 100 characters, surrounding spaces removed. Unique across all tags. |
| Description | Optional, up to 500 characters. Clearing it removes it.                             |
| Status      | Active on creation; can be switched inactive and back.                              |

- A duplicate name is rejected with "A tag with this name already exists.", also when two people add the same name at
  the same moment.
- Codes are assigned in order with no gaps and no repeats, even when several tags are created at the same time or a
  creation fails part-way.
- Tags cannot be deleted.
- Clicking a tag's code opens it read-only; Edit switches the dialog to editing.

## 7. Non-Functional Requirements

- All tag operations require a signed-in user.

## 8. Key Workflows

**Retiring a label**

1. The operator finds the tag with search or a filter.
2. They flip its status switch to inactive. The list updates immediately; if the change fails, the switch flips back
   and an error is shown.

## 9. Integrations & Side Effects

- **Audit log ([PRD-04](04-audit-activity-log.md))**: creating a tag, and every change to its name, description or
  status (with old and new values), is recorded.

## 10. Out of Scope

- Deleting tags.
- Bulk import or export.

## 11. Open Questions

- None at this time.

## 12. References

- Routes: `/api/v1/tags` (create, list), `/api/v1/tags/:id` (get, update) —
  `apps/backend/src/routes/tag.routes.ts`
- Business rules: `apps/backend/src/services/tag.service.ts`
- Model: `Tag`, running-number scope `TAG` in `apps/backend/prisma/schema.prisma`
- DTOs: `packages/shared/src/dto/tag/`; error code `DUPLICATE_TAG_NAME`
- Frontend: `apps/frontend/src/pages/tag/`, `apps/frontend/src/api/tag.ts`
