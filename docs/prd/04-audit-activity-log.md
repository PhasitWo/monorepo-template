# PRD-04 — Audit Activity Log

## 1. Overview

The audit log is a permanent record of who changed what and when. Every change to business data, every sign-in and
every failed sign-in adds one entry. Operators read it on the Audit log page, newest first, and can filter it.

## 2. Goals

- Answer "who changed this, and what was it before?" for any record.
- Spot suspicious sign-in attempts.
- Never lose an entry for a change that happened, and never record a change that didn't.

## 3. Non-Goals

- Undoing a change from the log.
- Alerts or notifications.

## 4. Personas

| Persona  | Needs                                                               |
| -------- | ------------------------------------------------------------------- |
| Operator | Trace a record's history, or check who signed in and who failed to. |

## 5. User Stories

- As an operator, I see the latest activity first.
- As an operator, I filter the log by action, record type or date.
- As an operator, I see exactly which fields an update changed, with old and new values.

## 6. Functional Requirements

**What is recorded**

| Event               | Recorded details                                                   |
| ------------------- | ------------------------------------------------------------------ |
| A record is created | Record type and id                                                 |
| A record is updated | Record type and id, and each changed field with old → new          |
| A record is deleted | Record type and id                                                 |
| Successful sign-in  | The account                                                        |
| Failed sign-in      | The username tried, and whether it was unknown or a wrong password |
| Session renewal     | The account                                                        |

- Every entry also stores when it happened, who did it (account id and username at the time), their IP address and
  browser, and a request id.
- Updates that change nothing visible (only timestamps or codes) record an empty change list.
- Passwords are never recorded — not even as old/new values.
- Entries cannot be edited or deleted through the app.

**Reading the log**

- The page lists time, user, action, record type and changes, newest first.
- Filters: action, record type, date.

## 7. Non-Functional Requirements

- An entry is written in the same step as the change it describes: if the change fails, no entry remains; if the
  entry can't be written, the change is cancelled.
- Failed sign-ins are the exception: they are recorded even though the sign-in itself fails.
- Reading the log requires a signed-in user.

## 8. Key Workflows

**Who renamed this tag?**

1. The operator opens Audit log and filters record type = Tag.
2. They find the update entry for the tag and read the old and new name, the user and the time.

## 9. Integrations & Side Effects

- Receives entries from [PRD-01](01-auth-and-sessions.md) (sign-ins), [PRD-02](02-users.md) (accounts) and
  [PRD-03](03-tags.md) (tags). Every new feature that changes data must add its entries here.

## 10. Out of Scope

- Exporting the log.
- Retention limits or automatic clean-up.

## 11. Open Questions

- How long must entries be kept, and who may read them once roles exist?

## 12. References

- Route: `GET /api/v1/audit-logs` — `apps/backend/src/routes/auditLog.routes.ts`
- Writer and list: `apps/backend/src/services/auditLog.service.ts` (`record`, `recordStandalone`, `list`),
  `apps/backend/src/common/utils/computeDiff.ts`
- Model: `AuditLog`, enums `AuditAction` / `AuditEntityType` in `apps/backend/prisma/schema.prisma`
- DTOs: `packages/shared/src/dto/audit-log/`
- Frontend: `apps/frontend/src/pages/audit-log/`, `apps/frontend/src/api/audit-log.ts`
