# Agent Guide

Full-stack TypeScript monorepo template: a Fastify + Prisma + PostgreSQL API in a routes → controllers → services
layout (services use Prisma directly), a React + Vite + shadcn/ui back-office frontend, and a shared Zod DTO package. It ships with JWT auth (login +
refresh-token rotation), user management, an audit log, gapless running numbers, and one example domain (**tags**)
that shows every layer.

Read this whole file before changing code. When a rule here conflicts with a skill file, **this file wins** — and fix
the skill.

> **Starting a new project from this template?** Follow the checklist in `README.md` → _Using this template_, then
> update the one-paragraph description above to say what _your_ product is.

## Golden Rules

1. **Copy the nearest existing example.** The `tag` domain is the smallest complete slice
   (`routes/tag.routes.ts` → `controllers/tag.controller.ts` → `services/tag.service.ts` → shared DTO → frontend page).
   Mirror its file names, structure and style.
2. **Use npm workspaces, not turbo filters, for per-package scripts:** `npm run <script> -w <package>`.
   `npm run test --filter=...` does **not** work (there is no root `test` script).
3. **Never edit generated code:** `apps/backend/src/.generated/` (Prisma client) and `packages/shared/dist/`.
4. **Never edit an applied migration** in `apps/backend/prisma/migrations/`. Add a new one.
5. **Every write that changes business data** runs inside `unitOfWork.execute()` and records an audit entry
   (see [Writes, transactions & audit](#writes-transactions--audit)).
6. **Keep the layering:** Prisma queries, business rules, transactions and audit live only in services; HTTP concerns
   (request parsing, status codes, response mapping) only in controllers; wiring and OpenAPI schemas only in routes. The frontend never
   redeclares a DTO shape that exists in `@repo/shared`.
7. **Before committing:** `npm run format`, `npm run lint`, `npm run build` (must pass), and
   `npm test -w @app/backend`. If something fails and it's not caused by your change, stop and tell the user.

## Commands

Run from the repo root. Package manager is **npm** (`npm@10`, Node ≥ 18; the Docker image and CI use Node 22).

```sh
npm install                                        # install all workspaces
npm run build                                      # turbo: shared → backend (prisma generate + tsc) → frontend (tsc -b + vite)
npm run dev                                        # turbo: backend (nodemon+tsx, :3000) + frontend (vite, :5173) + shared (tsc --watch)
npm run format                                     # prettier on **/*.{ts,tsx,md}
npm run lint                                       # turbo: eslint in every package
npm run check-types                                # turbo: builds @repo/shared, then type-checks every package

npm test -w @app/backend                           # backend unit tests (jest, excludes integration)
npm run test:coverage -w @app/backend              # with coverage (threshold: 80% lines/statements)
npm run test:integration -w @app/backend           # integration tests — needs Docker (Testcontainers Postgres)
npx jest src/services/__tests__/tag.service.test.ts  # one test file (run inside apps/backend)
npm run check-types -w @app/backend                # prisma generate + tsc --noEmit (needs @repo/shared built)
npm run lint -w @app/frontend                      # any package's script works with -w <package>
```

Root scripts go through turbo; per-package scripts use `-w <package>`. Every package defines `build`, `lint` and
`check-types`.

### Local setup

- Database: any PostgreSQL 14+. Quick start:
  `docker run -d --name app-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app -p 5432:5432 postgres:16-alpine`.
- Backend env: `cp apps/backend/.env.example apps/backend/.env` (`.env` is gitignored) and point `DATABASE_URL` at the
  database. Env is validated at boot by `apps/backend/src/common/config/validateEnv.ts` — production refuses to start
  without `JWT_SECRET` (or both `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`).
- Frontend env: `cp apps/frontend/.env.example apps/frontend/.env` (`VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`).
- DB (inside `apps/backend`): `npx prisma migrate dev` to apply/create migrations, `npx prisma db seed` to create the
  first account — username `admin` (override with `SEED_ADMIN_USERNAME`) and a random password printed once (or
  `SEED_ADMIN_PASSWORD`). The seed is idempotent.
- Swagger UI: `http://localhost:3000/docs`. Health: `/health` (DB ping), `/ping`.

## Repository Map

| Path                      | Package               | What                                                                 |
| ------------------------- | --------------------- | -------------------------------------------------------------------- |
| `apps/backend/`           | `@app/backend`        | Fastify 5, Prisma 7 (pg adapter), Zod 4, PostgreSQL, Jest            |
| `apps/frontend/`          | `@app/frontend`       | Vite 8, React 19, Tailwind 4, shadcn/ui, react-router 7 (HashRouter) |
| `packages/shared/`        | `@repo/shared`        | Zod request/response DTOs + `ERROR_CODE`, used by both apps          |
| `packages/eslint-config/` | `@repo/eslint-config` | Shared ESLint flat config (shared + frontend use it)                 |
| `docs/prd/`               | —                     | Product requirement docs per feature area (business audience)        |
| `docs/specs/`             | —                     | Dated implementation specs `YYYYMMDD-HHmm-<name>.md`                 |
| `.agents/skills/`         | —                     | Agent skills (`.claude/skills` is a symlink to this)                 |
| `.github/workflows/`      | —                     | `ci.yml` (PR checks), `deploy.yml` (Cloud Run), `pr-review.yml` (AI) |

`@repo/shared` compiles to `dist/`; the apps import the built output. After changing shared DTOs, run `npm run build`
(or have `npm run dev` running) before the apps see the change.

## Backend (`apps/backend/src`)

Three layers, one folder each: **routes → controllers → services**. There is no repository layer — services query
Prisma directly. A controller calls only its own service; a service may call other services (e.g. `AuthService` uses
`UserService` to look up users).

```
server.ts                            Fastify setup; registers every routes file
routes/<domain>.routes.ts            wires deps (manual DI) + declares routes & OpenAPI schema
routes/routeBuilder.ts               registerRoutes, baseSchema/publicSchema, idParamsSchema, response schemas
controllers/<domain>.controller.ts   casts the validated request, calls the service, maps record → response DTO
controllers/baseController.ts        response helpers, processPagination, buildPaginationMeta
services/<domain>.service.ts         Prisma queries + business rules, NotFound/Conflict errors, transactions, audit
services/baseService.ts              this.prisma (ambient tx client), this.rootPrisma, pageArgs, filter allow-list,
                                     ListParams / ListResult
services/auditLog.service.ts         audit writer (record / recordStandalone, EXCLUDED_FIELDS) + list
middlewares/authMiddleware.ts        verifies the JWT, sets request.user + the audit actor
common/database/                     DatabaseClient, UnitOfWork, TransactionContext, runningNumberAllocator,
                                     prismaErrors (mapUniqueViolation), seed
common/context/auditContext.ts       request-scoped audit context (fastify request-context)
common/errors/                       errorTypes: ValidationError(400) UnauthorizedError(401) NotFoundError(404)
                                     ConflictError(409) …; errorHandler: one JSON error envelope
common/config/                       appConfig, validateEnv, swaggerConfig
common/plugins/zodValidatorCompiler  Zod for body/query, Ajv for params
common/utils/                        computeDiff (audit diffs), useZodSchema, zodToJsonSchema
<folder>/__tests__/*.test.ts         unit tests, in a __tests__ folder beside the code they test
__tests__/utils/                     mockFactory (createMock, createMockUnitOfWork), prismaMock, http
__tests__/integration/*.int.test.ts  real Postgres via Testcontainers
```

There are no domain entities and no interfaces: services return the Prisma-generated model types (`Tag`, `AuditLog`,
…) imported from `'../.generated/client'`, and controllers map them to the shared response DTOs. Where a model holds a
secret, its service returns a narrowed type instead (`SafeUser = Omit<User, 'password'>`, enforced with Prisma `omit`
on every query) and exposes the secret through one dedicated method (`UserService.findPasswordByUsername`).

Route registration in `server.ts`: auth routes are public; everything else is registered inside a plugin that adds
`authMiddleware` as a `preHandler` hook — **don't add auth middleware per route**. All routes live under `/api/v1`.

Built-in endpoints: `POST /auth/login`, `POST /auth/refresh` (public); `/users` CRUD, `/tags` CRUD (no delete — tags
are deactivated), `GET /audit-logs` (authenticated). Every signed-in user can do everything — there are no roles yet.

### Adding or changing an endpoint (checklist)

1. **DTO** — `packages/shared/src/dto/<domain>/request.ts` and `response.ts`; export them from
   `packages/shared/src/index.ts`. Pattern: `export const xSchema = z.object(...)` +
   `export type X = z.infer<typeof xSchema>`. List queries spread `paginationQueryShape`. Query params are strings
   (`z.enum(['true','false'])`, `z.string().regex(/^[1-9]\d*$/)` for numbers). **No `.transform()`** (breaks
   OpenAPI); `.refine()` / `.trim()` are OK.
2. **Prisma** — model in `apps/backend/prisma/schema.prisma`, then (inside `apps/backend`)
   `npx prisma migrate dev --name <snake_case_change>`. Commit the generated migration folder.
3. **Service** — `services/<domain>.service.ts`, `extends BaseService`; one class per domain, dependencies via the
   constructor (`UnitOfWork`, `AuditLogService`, other services) and `super()`. Query through `this.prisma` (ambient
   transaction-aware client) and return the Prisma row type. `getById` throws `NotFoundError`; writes: see below.
   Normalise input here (trim, blank → `null`). List methods take `List<X>Params extends ListParams`, spread
   `this.pageArgs(params)`, and use `transformToWhereClause` with a per-field allow-list for `filters`. Throw
   `errorTypes` classes; for user-facing codes pass `{ code: ERROR_CODE.X }` (add new codes + their text to
   `packages/shared/src/error/index.ts`).
4. **Controller** — `controllers/<domain>.controller.ts`, extends `BaseController`; handlers are arrow-function
   properties. Use `this.processPagination()`, `this.buildPaginationMeta()`, and `successResponse` (200) /
   `createdResponse` (201) / `paginatedResponse` / `noContentResponse` (204). Cast `request.body/query/params` to the
   shared types. Map records with a module-level `mapTo<X>DetailResponse()`; dates go out as ISO strings.
5. **Routes** — `routes/<domain>.routes.ts`: instantiate services → controller, then `registerRoutes(fastify, [...])`.
   Schema: `...baseSchema(tag, summary, description)`, `body`/`querystring: useZodSchema(schema)`,
   `params: idParamsSchema`, `response` includes `...commonErrorResponses` and
   `200|201|204: successResponseSchema(responseSchema, '...')`. New routes file → register it in `server.ts` and
   `routes/__tests__/routes.test.ts`.
6. **Tests** — `services/__tests__/<domain>.service.test.ts` at minimum; `controllers/__tests__/` for non-trivial
   mapping (see [Testing](#testing)).
7. **Frontend** — API function + page + nav entry (see [Frontend](#frontend-appsfrontendsrc)).
8. **PRD** — if user-visible behavior changed, update `docs/prd/` (skill: `prd`).

### Writes, transactions & audit

Canonical example: `TagService.update` in `services/tag.service.ts`.

```ts
return this.unitOfWork.execute(async () => {
  const existing = await this.getById(id);                    // throws NotFoundError
  const updated = await mapUniqueViolation(
    () => this.prisma.tag.update({ where: { id }, data: { ... } }),
    duplicateTagNameError,
  );
  await this.auditLogService.record({ action: AuditAction.UPDATE, entityType: AuditEntityType.TAG,
                                      entityId: id, before: existing, after: updated });
  return updated;
});
```

- `unitOfWork.execute()` opens a Prisma transaction and stores it in AsyncLocalStorage (`TransactionContext`). Every
  `this.prisma` query inside — even from another service — joins it automatically; nested `execute()` joins the outer
  one. **Always `await` DB work inside it**; un-awaited work throws "Database used after its unit of work closed".
- `auditLogService.record()` writes in the same transaction (a failure rolls back the write). `recordStandalone()`
  writes on the root client, outside it, best-effort — only for events that must survive a thrown error, like a
  failed login.
- CREATE / DELETE audit entries need only `action`, `entityType`, `entityId`. UPDATE-like entries pass the loaded row
  as `before` and the row Prisma returned as `after` (two separate objects — nothing is mutated in place); the diff
  drops system fields and redacts `password`.
- New entity types / actions change **two** enums together: Prisma `AuditAction` / `AuditEntityType` (+ migration) and
  the Zod enum in `packages/shared/src/dto/audit-log/request.ts`. The backend uses the Prisma-generated enums directly.
- Unique-value races: do a pre-check (friendly `ConflictError`) **and** wrap the write in
  `mapUniqueViolation(() => this.prisma..., duplicateXError)` so the race where both requests pass the pre-check gets
  the same 409. Keep `duplicateXError` a module-level factory in the service file.
- Slow non-DB work (bcrypt, HTTP calls) goes **before** `execute()`, not inside it.

### Running numbers

Models with `runningId` / `runningCode` (the example: Tag `T000001`) get them from
`allocateRunningNumber(this.prisma, RunningNumberScope.X, key)` inside the service's create, **in the same unit of
work and immediately before the insert** — this keeps numbers gapless and collision-free. Don't compute `max()+1`.
`key` is `''` for a global sequence or a parent id for a per-parent one. New scope → add to the `RunningNumberScope`
enum + a migration.

### Access & scoping

- Every authenticated user can call every authenticated route. Add roles/permissions as a new middleware in
  `middlewares/` or a service check when a project needs them, and document them here.
- There is no multi-tenancy. The `fastify-zod` skill has the pattern for scoping records to a tenant/parent if a
  project needs it — every service query then takes and filters by the tenant id.
- Users are **soft-deleted** (`deletedAt`); reads filter `deletedAt: null`. Deleting a user also revokes their refresh
  tokens. Usernames stay reserved after deletion.

### Prisma & database

- Schema: `apps/backend/prisma/schema.prisma`. Client is generated to `src/.generated/` — import from
  `'../.generated/client'`, never `@prisma/client`. Regenerate with `npm run generate:prisma -w @app/backend`
  (the build does it too).
- Only services (and `common/database/`) run queries, always through `this.prisma` / `this.rootPrisma` from
  `BaseService` — never `DatabaseClient.getInstance()` directly (it escapes the unit of work). Controllers may import
  Prisma **types** (`Tag`) for mapping, never the client.
- New migration (inside `apps/backend`): `npx prisma migrate dev --name <snake_case_change>`. Commit the generated
  folder. Production runs `prisma migrate deploy` on container start (`start:migrate`).
- The schema uses **no** `@map`/`@@map`: tables and columns are the PascalCase / camelCase model names, so raw SQL
  must double-quote them: `INSERT INTO "RunningNumber" ("scope", "key") ...`. Use tagged-template `` $queryRaw`...` ``
  (parameterised), never `$queryRawUnsafe` with interpolated input. Skill: `prisma-raw-query`.
- Timestamps are `@db.Timestamptz(6)`; ids are `uuid` with `@db.Uuid`.

### Testing

- Unit tests live in a `__tests__/` folder beside the code: `services/tag.service.ts` →
  `services/__tests__/tag.service.test.ts`. Jest only runs `**/__tests__/**/*.test.ts`, so helpers inside `__tests__/`
  must not end in `.test.ts`.
- **Services** — `mockDatabaseClient()` from `__tests__/utils/prismaMock.ts` points `DatabaseClient` at `jest.fn()`
  model methods (add a model there when a new service needs it); collaborators come from
  `__tests__/utils/mockFactory.ts`: `createMock<AuditLogService>()` (any class; methods auto-stub on first use) and
  `createMockUnitOfWork()`. Assert the Prisma arguments, the business outcome, and placement with
  `expectCalledInTx(db.tag.create)` / `expectCalledOutsideTx(...)`. Never hand-list every method in a mock. Build
  fixtures as plain Prisma-shaped objects with a local `makeX(overrides)` helper.
- **Controllers** — `makeRequest` / `makeReply` / `sent` from `__tests__/utils/http.ts` with a `createMock<XService>()`.
- Test behavior that matters: conflict/not-found errors, unique-violation mapping, audit entries, "write happened in
  tx", and that nothing is audited on failure.
- Integration tests (`__tests__/integration/*.int.test.ts`) hit a real Postgres (Docker required) — use them for SQL,
  locking, and constraint behavior that mocks can't prove. Add new tables to `resetDb()` in
  `__tests__/integration/helpers.ts`.
- `__tests__/` folders are excluded from ESLint and from `tsconfig.json`, and ts-jest reports type errors only as
  warnings — read the jest output for `TS` diagnostics, a green run can still hide them.

## Frontend (`apps/frontend/src`)

```
App.tsx                 all routes (HashRouter); signed-out vs signed-in route trees
layouts/main-layout.tsx sidebar navigation (navGroups), theme toggle, sign-out
api/<domain>.ts         `export const XAPI = { ... }` — one async fn per endpoint; re-exported from api/index.ts
api/service.ts          axiosInstance (adds Bearer token, refreshes on 401), handleError, APIResponse, clearSession
pages/<domain>/         index.tsx (page + data loading), table.tsx (@tanstack/react-table), manage.tsx (form dialog)
components/             app components (data-table with filters/search/pagination, page-header, cell-link, …)
components/ui/          shadcn-generated primitives — add via `npx shadcn add <c>`; avoid hand edits
contexts/ + hooks/      app state (session, current user), theme, dialog alert, use-fetch, use-toast-error
constants/              APP_NAME, STORAGE_KEY
```

Conventions:

- **API functions never throw.** They return `APIResponse<T>` = `SuccessResponse<T> | ErrorResponse`
  (try → `resp.data`, catch → `handleError(err)`). Callers branch on `resp.success` and show failures with
  `toastError(resp.error)` from `useToastError()` (maps `ERROR_CODE` → text, falls back to the server message).
  For a 204 (no body) the API function builds the success envelope itself (see `UserAPI.deleteUser`).
- Type request/response data with the `@repo/shared` types — don't redeclare DTO shapes. Forms may reuse the shared
  Zod schemas with `zodResolver`.
- List pages use `useFetch<ListXResponse>()` for pagination/search/filters synced to the URL, and pass
  `transformedQuery` to the API. Follow `pages/tag/index.tsx`.
- Forms: `react-hook-form` + `zodResolver` + shadcn `Field`/`Controller`. Mode is `'view' | 'add' | 'edit'`.
- Confirmations (e.g. delete) use `useDialogAlert().openDialog({ mode: 'warning', ... })`.
- New page → route in `App.tsx` + entry in `navGroups` in `layouts/main-layout.tsx`.
- Imports use the `@/` alias for `src/`. Components are function components in kebab-case files; pages and their
  `table.tsx` / `manage.tsx` are default exports.
- Dates: format with the `Intl` formatters in `lib/utils.ts` (`dateTimeFormatter`, `dateFormatter`).
- UI text is English. If a project localises, keep all user-facing strings in one language and put error texts in
  `ERROR_CODE_TEXT_MAP`.
- Session: tokens live in `localStorage`; `AppStateProvider` exposes `signIn` / `signOut`; the axios interceptor
  refreshes the access token once on a 401 (never for `/auth/*`) and signs out if the refresh fails.

## Code Style

- Prettier: single quotes, semicolons, 2-space indent, trailing commas, `printWidth: 120`, LF. Run `npm run format`.
- Backend: layer files are `<camelCaseDomain>.<layer>.ts` (`auditLog.service.ts`, `tag.routes.ts`); other files are
  camelCase (`computeDiff.ts`, `baseService.ts`). Frontend files are
  kebab-case (`page-header.tsx`).
- TypeScript `strict`; avoid `any` (lint warns). Prefix unused args with `_`.
- Comments are sparse and explain _why_. Don't add comments that restate code.
- No secrets in code or logs: config comes from env (`appConfig`), passwords are only ever hashed, services never
  return the password hash, audit diffs redact `password`.

## Docs, Specs & Workflow

- Conventional commits: `type(scope): lowercase imperative summary` — e.g. `fix(backend): ...`, `feat(audit): ...`.
  Append `[skip ci]` to commits that should not deploy (docs/chore).
- Branches: `feat/<name>` or `fix/<name>`; PRs into `main`. Don't commit or push unless the user asks.
- PRs run `.github/workflows/ci.yml` (build, lint, unit + integration tests).
- **Pushing to `main` deploys the backend** to Cloud Run (`.github/workflows/deploy.yml`, triggered by changes under
  `apps/backend/**`, `packages/**`, `.github/workflows/**`) once the repository variables are configured, and runs
  pending migrations on boot.
- Larger work starts from a spec in `docs/specs/`. When product behavior changes, update the matching PRD in
  `docs/prd/` (business language, no code) — routing table is in `.agents/skills/prd/SKILL.md`.

## Skills

Skills live in `.agents/skills/<name>/SKILL.md`. Read the relevant one before the matching task:

| Skill                                        | Use for                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `fastify-zod`                                | Backend feature work (routes/controllers/services), with examples in `references/`   |
| `unit-test-mocks`                            | Unit tests: Prisma client mock, class mock factory, transaction-placement assertions |
| `prisma-raw-query`                           | `$queryRaw` / `$executeRaw`                                                          |
| `prd`                                        | Updating `docs/prd/` after a behavior change                                         |
| `spec-analysis` / `spec-create` / `spec-run` | Spec-driven workflow (user-invoked)                                                  |
| `commit`                                     | Conventional commit message + commit (also used by `pr`)                             |
| `pr`                                         | Opening a PR (user-invoked)                                                          |

The same skills serve Claude Code (`.claude/skills` → symlink) and Codex (reads `.agents/skills` directly). A
**user-invoked** skill must be marked for both tools — never one without the other:

- `SKILL.md` frontmatter: `disable-model-invocation: true` (Claude Code)
- `<skill>/agents/openai.yaml` with `policy: { allow_implicit_invocation: false }` (Codex; it has no equivalent
  frontmatter key). Copy it from `.agents/skills/pr/agents/openai.yaml`.

Don't write `$ARGUMENTS` (or `$1`, `$2`, …) in a skill — Claude Code substitutes them but Codex shows them as literal
text. Refer to "the arguments" in prose and copy the **Arguments** paragraph from `.agents/skills/spec-run/SKILL.md`;
Claude Code then appends an `ARGUMENTS:` line, and Codex reads the text after `$skill-name` from the user's message.

Skill `references/` point at real files in this repo instead of copying large code blocks — when you change a
pattern, update the canonical file and the short excerpt in the skill together. When a project replaces the example
`tag` domain, re-point the skills' examples at the project's own smallest domain.

## Gotchas

- Always `npm install` from the root; the root `package-lock.json` is the only lockfile.
- `processPagination` caps `pageSize` at `MAX_PAGE_SIZE`; `all=true` disables paging and returns a plain array (no
  pagination meta).
- A 204 response has no body — the frontend can't read `resp.data.success` from it.
- `appConfig` falls back to fixed JWT secrets outside production so local dev works without config; never rely on
  that fallback anywhere real (`validateEnv` blocks it in production).
- Prisma `update` / `delete` throw `P2025` when the row is missing — services load the record first (`getById`) so the
  client gets a 404, not a 500.
- `jest.Mocked<SomeClass>` from `createMock` covers public methods only; test through the public API, not private
  helpers.
- npm 11 may skip dependency install scripts (`allow-scripts` warning). If Prisma or bcrypt misbehave after install,
  run `npm approve-scripts` for them or use npm 10 (`packageManager` pins `npm@10.8.2`).
