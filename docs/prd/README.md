# Product Requirement Documents

Product-side description of each feature area. Each PRD describes what the feature does, who uses it, and how it
behaves. It is written for a business reader.

- API detail lives in the Swagger UI generated from the backend route schemas (`/docs`).
- Data shapes live in `packages/shared/src/dto/` and `apps/backend/prisma/schema.prisma`.
- Change specs live in `docs/specs/`. PRDs link to them from their _References_ section.
- PRDs are maintained with the `prd` skill (`.agents/skills/prd/SKILL.md`).

## Index

| #   | PRD                                                  | One-line summary                                                                   |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 01  | [Authentication & Sessions](01-auth-and-sessions.md) | Username/password sign-in, long-lived sessions with silent token renewal.          |
| 02  | [Users](02-users.md)                                 | Accounts that can sign in; added, renamed and removed by any signed-in user.       |
| 03  | [Tags (example domain)](03-tags.md)                  | Auto-numbered labels with active/inactive status — the template's example feature. |
| 04  | [Audit Activity Log](04-audit-activity-log.md)       | Record of every business change and sign-in, with who, when and what changed.      |

## Shared conventions

These apply across all PRDs and are not repeated in each one.

| Topic            | Convention                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personas         | One persona today: the **Operator**, a signed-in user of the back office. There are no roles or permissions yet — every signed-in user can do everything.                                                                                                              |
| Running codes    | Numbered records get a readable code made of a prefix and a 6-digit number, e.g. `T000001` for a tag. The number goes up by one per record, never repeats, and never skips. Each PRD states its prefix.                                                                |
| Lists            | Every list is paginated: 10 rows per page by default on screen (selectable up to 50), at most 100 through the API. Lists support free-text search where stated, and per-column filters (equals, contains, starts/ends with, greater/less than, before/after, between). |
| Active/inactive  | Records that other data may refer to are not deleted; they are switched **inactive** and stay visible in history.                                                                                                                                                      |
| Language & dates | The UI is in English. Dates and times display in the viewer's browser locale.                                                                                                                                                                                          |
| Audit            | Every change to business data is recorded in the audit log, in the same step as the change. See [PRD-04](04-audit-activity-log.md).                                                                                                                                    |
