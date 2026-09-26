# PRD-02 — Users

## 1. Overview

A user is an account that can sign in ([PRD-01](01-auth-and-sessions.md)). Operators manage accounts on the Users page:
they add colleagues, correct display names, and remove people who no longer need access. The first account is created
when the system is installed.

## 2. Goals

- Give each person their own account, so the audit log shows who did what.
- Remove access immediately when someone leaves.

## 3. Non-Goals

- Roles, permissions or per-feature access.
- Users changing their own password or profile.

## 4. Personas

| Persona  | Needs                                                    |
| -------- | -------------------------------------------------------- |
| Operator | Add and remove colleagues' accounts, keep names correct. |

## 5. User Stories

- As an operator, I add an account with a username, display name and initial password.
- As an operator, I change someone's display name.
- As an operator, I delete an account so that person can no longer sign in.
- As an operator, I search the user list by name or username.

## 6. Functional Requirements

**Account record**

| Field        | Rules                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Username     | Required, at least 4 characters, letters/digits/dot/dash/underscore only. Unique. Cannot change later. |
| Display name | Required. Can change.                                                                                  |
| Password     | Set on creation, at least 8 characters. Never shown again.                                             |

- A username that is already taken — including by a deleted account — is rejected with "This username is already
  taken.", also when two people add the same username at the same moment.
- The list shows username, display name and created date, oldest first, with search by name or username.

**Deleting**

- Deleting asks for confirmation. A deleted account disappears from the list, cannot sign in, and its open sessions
  end at their next renewal.
- Operators cannot delete their own account from the Users page.
- Deleted accounts are kept in the background so the audit log still names them.

**First account**

- Installation creates one account (`admin` by default) with a random password that is shown once to the installer.

## 7. Non-Functional Requirements

- All user operations require a signed-in user.
- Passwords are stored only as one-way hashes and are never returned or recorded in the audit log.

## 8. Key Workflows

**A new colleague joins**

1. An operator opens Users → Add user, enters the colleague's username, name and a temporary password.
2. They pass the credentials to the colleague, who signs in.

**A colleague leaves**

1. An operator opens Users, clicks delete next to the colleague and confirms.
2. The colleague is signed out at their next session renewal and can no longer sign in.

## 9. Integrations & Side Effects

- **Sessions ([PRD-01](01-auth-and-sessions.md))**: deleting an account ends all of its sessions.
- **Audit log ([PRD-04](04-audit-activity-log.md))**: adding, renaming (with old and new name) and deleting accounts
  are recorded.

## 10. Out of Scope

- Restoring a deleted account.
- Changing a username or resetting another user's password.

## 11. Open Questions

- Should operators be able to reset a colleague's password?
- When roles arrive, who may manage users?

## 12. References

- Routes: `/api/v1/users` (create, list), `/api/v1/users/:id` (get, update, delete) —
  `apps/backend/src/routes/user.routes.ts`
- Business rules: `apps/backend/src/services/user.service.ts`
- Model: `User` in `apps/backend/prisma/schema.prisma`; first account: `apps/backend/src/common/database/seed.ts`
- DTOs: `packages/shared/src/dto/user/`; error code `DUPLICATE_USERNAME`
- Frontend: `apps/frontend/src/pages/user/`, `apps/frontend/src/api/user.ts`
