# PRD-01 — Authentication & Sessions

## 1. Overview

Operators sign in with a username and password. A successful sign-in starts a session that stays alive for up to
seven days of inactivity without asking for the password again: the app silently renews its short-lived access pass
in the background. Signing out ends the session in that browser.

## 2. Goals

- Only people with an account can see or change any data.
- Operators are not interrupted by frequent re-logins during a working week.
- Every sign-in — successful or not — is traceable.

## 3. Non-Goals

- Self-service sign-up, password reset by email, or "remember me" options.
- Single sign-on (Google, Microsoft, SAML) or multi-factor authentication.
- Roles and permissions (see [PRD-02](02-users.md), Out of Scope).

## 4. Personas

| Persona  | Needs                                                                |
| -------- | -------------------------------------------------------------------- |
| Operator | Sign in quickly, stay signed in during the week, sign out when done. |

## 5. User Stories

- As an operator, I sign in with my username and password.
- As an operator, I stay signed in while I keep using the app, without re-entering my password.
- As an operator, I sign out so the next person at this computer can't use my session.

## 6. Functional Requirements

- The sign-in screen asks for a username and a password (at least 6 characters). Wrong credentials show "Invalid
  username or password" without saying which part was wrong.
- A successful sign-in opens the app on its first page and shows the operator's name in the sidebar.
- The session consists of a short-lived access pass (60 minutes by default) and a renewal pass (7 days by default).
  When the access pass expires, the app renews both passes automatically; each renewal pass works only once.
- If renewal fails (expired, already used, or the account was removed), the operator is returned to the sign-in
  screen.
- Signing out from the sidebar clears the session in that browser and returns to the sign-in screen.
- Deleted accounts cannot sign in, and their open sessions stop working at the next renewal ([PRD-02](02-users.md)).

## 7. Non-Functional Requirements

- Every page and API call except sign-in and renewal requires a valid access pass.
- Passwords are stored only as one-way hashes; they never appear in logs, responses or the audit log.
- The server refuses to start in production without its own signing secret.

## 8. Key Workflows

**Daily use**

1. The operator opens the app and signs in.
2. They work normally; every hour the app renews the session in the background.
3. At the end of the day they sign out, or close the browser and come back within seven days still signed in.

**Wrong password**

1. The operator mistypes the password; the app shows an error and stays on the sign-in screen.
2. The failed attempt, with the username tried, is recorded in the audit log.

## 9. Integrations & Side Effects

- **Audit log ([PRD-04](04-audit-activity-log.md))**: successful sign-ins, failed sign-ins (with the reason: unknown
  user or wrong password) and session renewals are recorded.

## 10. Out of Scope

- Signing out every device at once (except by deleting the account).
- Locking an account after repeated failed sign-ins.

## 11. Open Questions

- Should repeated failed sign-ins lock the account or slow down further attempts?

## 12. References

- Routes: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh` — `apps/backend/src/routes/auth.routes.ts`
- Business rules: `apps/backend/src/services/auth.service.ts` (login, refresh)
- Middleware: `apps/backend/src/middlewares/authMiddleware.ts`
- Model: `RefreshToken` in `apps/backend/prisma/schema.prisma`; settings `JWT_*` in `apps/backend/.env.example`
- DTOs: `packages/shared/src/dto/auth/`
- Frontend: `apps/frontend/src/pages/login.tsx`, `apps/frontend/src/api/service.ts` (renewal),
  `apps/frontend/src/contexts/app-state-provider.tsx`
