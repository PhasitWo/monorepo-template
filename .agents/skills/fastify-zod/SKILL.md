---
name: fastify-zod
description: Use when adding or changing a backend feature — routes, controller, service or shared Zod DTO — in the routes → controllers → services Fastify + Zod + Prisma backend (`apps/backend`), where services query Prisma directly. Covers the per-layer checklist, transactions and audit, running numbers, unique-constraint races, and scoping records to a parent/tenant.
---

# Overview

The backend has three layers, one folder each, and no repository layer. A request flows down one layer at a time:

1. **Routes** (`src/routes/<domain>.routes.ts`) — wires dependencies (manual DI), validates body/query with Zod and
   params with JSON schema, documents the endpoint for OpenAPI
2. **Controller** (`src/controllers/<domain>.controller.ts`) — casts the validated request to shared types, calls the
   service, maps the Prisma record → response DTO
3. **Service** (`src/services/<domain>.service.ts`) — Prisma queries through the ambient client, business rules,
   input normalisation, not-found/conflict errors, transactions, audit entries

There are no entity classes and no interfaces: the Prisma-generated types (`Tag`, `User`, `Prisma.TagWhereInput`, …)
are the data model, and classes are injected (and mocked) directly. Middleware lives in `src/middlewares/`.

The **tag** domain is the smallest complete slice. When adding a domain, copy its files and rename:

```
packages/shared/src/dto/tag/{request,response}.ts          → export from packages/shared/src/index.ts
apps/backend/prisma/schema.prisma                           → model + `npx prisma migrate dev --name add_<x>`
apps/backend/src/services/tag.service.ts
apps/backend/src/services/__tests__/tag.service.test.ts
apps/backend/src/controllers/tag.controller.ts
apps/backend/src/controllers/__tests__/tag.controller.test.ts
apps/backend/src/routes/tag.routes.ts                       → call registerXRoutes in server.ts
apps/backend/src/routes/__tests__/routes.test.ts            → add a row for the new routes file
```

Plus the audit entity type — two places that must agree: the Prisma `AuditEntityType` enum (with a migration) and
`auditEntityTypeEnum` in `packages/shared/src/dto/audit-log/request.ts` — and a `RunningNumberScope` value if the
entity is numbered.

# Zod Schemas

**Location:** `packages/shared/src/dto/<domain>/request.ts` and `response.ts` (package `@repo/shared`, shared with
the frontend). Export every new file from `packages/shared/src/index.ts`, and rebuild shared (`npm run build`, or
keep `npm run dev` running) before the apps see changes.

**Rules:**

- **DO NOT** use `.transform()` / `.pipe()` into another type — it breaks OpenAPI generation (`toJSONSchema`).
  `.trim()`, `.min()`, `.regex()` and `.refine()` are fine.
- Validation that needs the database, or rules Zod can't express cleanly → do it in the service and throw
  `ValidationError`
- Pair every schema with its type: `export const xBodySchema = z.object(...)` + `export type XBody = z.infer<typeof xBodySchema>`
- Naming: `create<X>BodySchema`, `update<X>BodySchema`, `list<X>QuerySchema`, `<x>DetailResponseSchema`,
  `list<X>ResponseSchema`

**Common patterns:**

| Field type         | Schema                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| UUID               | `z.uuid()`                                                              |
| Optional           | `.optional()` (absent = "don't change" in update bodies)                |
| Clearable          | `.nullable().optional()` (`null` = clear the value)                     |
| Query boolean      | `z.enum(['true', 'false']).optional()` — query params arrive as strings |
| Query positive int | `z.string().regex(/^[1-9]\d*$/).optional()`                             |
| Response date      | `z.string()` — controllers send `date.toISOString()`                    |

**List query:** spread `...paginationQueryShape` (`all`, `page`, `pageSize`, `sortOrder`) from `dto/shared`, then add
`sortBy` (`z.enum` of sortable fields), `search` (plain text), `filters` (JSON string of `filterQuery` —
`[{ f, o, v1, v2 }]`, parsed by `processPagination`) and flags such as `isActive`.

See: [zod-schema-examples.md](./references/zod-schema-examples.md)

# Routes

**Rules:**

- **DO NOT** add the auth middleware per route — `server.ts` adds `authMiddleware` (from `src/middlewares/`) as a
  `preHandler` hook on the plugin that registers every non-public route. Public routes (auth only, today) live in the
  separate public plugin.
- One `routes/<domain>.routes.ts` per domain exporting `register<Domain>Routes(fastify)`: construct the services
  (`new XService(new UnitOfWork(), new AuditLogService())`) and the controller there (manual DI), then call it from
  `server.ts`
- Use the `registerRoutes()` helper from `routes/routeBuilder.ts`
- `...baseSchema(tag, summary, description)` for authenticated routes, `...publicSchema(...)` for public ones
- `body` / `querystring` → `useZodSchema(schema)`; `params` → plain JSON schema (`idParamsSchema` for `/:id`)
- `response` → `...commonErrorResponses` plus the success code: `200: successResponseSchema(schema, '...')`,
  `201` for creates, `204: successResponseSchema(undefined, '...')` for deletes
- Handler: `controller.method` (handlers are arrow-function properties, so no `.bind`)
- Paths are relative; `server.ts` mounts everything under `/api/v1`

See: [route-examples.md](./references/route-examples.md)

# Controller

**Rules:**

- Extend `BaseController` (`controllers/baseController.ts`); handlers are arrow-function properties; the constructor
  takes the domain's service
- Cast `request.body` / `query` / `params` to the shared types — Fastify already validated them
- List endpoints: `this.processPagination(rest)`; with `all=true` return `successResponse` (plain array, no
  pagination meta), otherwise `paginatedResponse(reply, data, this.buildPaginationMeta(page, pageSize, total))`
- Map record → response with a module-level `mapTo<X>DetailResponse()` typed by the shared response type; pick every
  field explicitly (never spread a Prisma row into a response)
- Status codes: `successResponse` (200) for reads/updates, `createdResponse` (201) for creates,
  `noContentResponse` (204) for deletes
- No business logic and no Prisma: no queries, no transactions, no audit, no not-found checks (the service throws)

See: [controller-examples.md](./references/controller-examples.md)

# Service

**Patterns by operation:**

| Operation      | Pattern                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| READ (getById) | `this.prisma.x.findUnique` → throw `NotFoundError` if `null` → return the record               |
| LIST           | Build `where` (search + allow-listed filters), `count` + `findMany` with `...this.pageArgs()`  |
| CREATE         | Normalise input → pre-check uniques → in a unit of work: insert (`mapUniqueViolation`) + audit |
| UPDATE         | In a unit of work: `getById` → pre-check uniques → `update` (`mapUniqueViolation`) → audit     |
| DELETE         | In a unit of work: `getById` → delete / soft-delete (+ dependent cleanup) → audit              |

- `extends BaseService` (`services/baseService.ts`), one class per domain; dependencies come in through the
  constructor as concrete classes (`UnitOfWork`, `AuditLogService`, other services), then `super()`
- Query through `this.prisma` for **every** query — it is the active unit-of-work transaction client, or the root
  client outside one. `this.rootPrisma` only for writes that must survive a surrounding rollback
  (`AuditLogService.recordStandalone`). Never call `DatabaseClient.getInstance()` in a service.
- Return Prisma rows as-is. If the model holds a secret, `omit` it on every query that returns a row and return a
  narrowed type (`SafeUser = Omit<User, 'password'>`); expose the secret through one dedicated method
  (`findPasswordByUsername`). Other services that need the model go through its service (`AuthService` →
  `UserService`), so the rule lives in one place.
- Nullable lookups other services need are public `findX` methods returning `null`; `getById` is the throwing variant
- Every write runs in `this.unitOfWork.execute(...)` and calls `this.auditLogService.record(...)` inside it (see
  Transactions). For UPDATE-like actions pass the loaded row as `before` and the updated row as `after`
- Normalise input (trim, blank → `null`, defaults) before writing
- `undefined` in an update means "leave unchanged" — pass it through; Prisma skips `undefined` fields
- Conflicts: a module-level `const duplicateXError = () => new ConflictError('...', undefined, { code: ERROR_CODE.X })`
  used by both the pre-check and `mapUniqueViolation`; add new codes and their user-facing text to
  `packages/shared/src/error/index.ts`
- Keep slow, non-DB work (password hashing, external calls) **outside** the transaction
- No Fastify imports and no HTTP concerns (status codes, response shapes)

**Queries:**

- List: `List<X>Params extends ListParams`; spread `...this.pageArgs(params)` into `findMany`;
  `transformToWhereClause<X>(filters, { field: this.transformTo<Kind>WhereClause })` — the config object is the
  **allow-list** of filterable fields; anything else is rejected with a 400. Return `{ total, data }` (`ListResult<X>`)
- Create: don't pass `id` or timestamps (database defaults)
- **Running numbers** (`runningId` / `runningCode`): allocate with
  `allocateRunningNumber(this.prisma, RunningNumberScope.X, key)` inside the create's unit of work, immediately before
  the insert — never `findFirst … orderBy runningId desc` + 1 (two concurrent creates read the same max). The counter
  row stays locked until commit (same-scope creates queue) and a rollback hands the number back (gapless). `key` is
  `''` for a global sequence, or a parent id for a per-parent sequence. A new numbered entity gets a new
  `RunningNumberScope` value (enum change + migration; if rows already exist, backfill the counter in that migration).
- **Unique constraints**: keep the pre-check (friendly error in the common case) **and** wrap `create` / `update` in
  `mapUniqueViolation(() => …, duplicateXError)` from `common/database/prismaErrors.ts` — it covers the race where
  both requests pass the pre-check. An unmapped `P2002` falls back to a generic 409 in `errorHandler`.
- **Row locks**: to serialize work on one record, add a private `lockById` doing `SELECT … FOR UPDATE` on
  `this.prisma` (skill: `prisma-raw-query`), called first inside `execute`. Take locks in a fixed order — parent row
  before any running-number counter — so two transactions never wait on each other.
- **Soft delete**: models with `deletedAt` filter `deletedAt: null` in every read and in `update`'s `where` (see
  `user.service.ts`).

See: [service-examples.md](./references/service-examples.md)

# Transactions

The unit of work keeps the active transaction in `AsyncLocalStorage` (`common/database/transactionContext.ts`), so it
never appears in service signatures.

- Wrap multi-write operations in `this.unitOfWork.execute(async () => { … })`. Every `this.prisma` query inside —
  including queries made by other services — joins the transaction automatically.
- There is no `tx` parameter. Query `this.prisma` and call `auditLogService.record(entry)` directly.
- A nested `execute` joins the outer transaction: one commit or rollback for everything.
- Always `await` database work inside `execute`. Work that outlives its transaction throws
  `InternalServerError('Database used after its unit of work closed …')`.
- Writes that must persist even if the surrounding work rolls back go through a dedicated root-client method (the
  `auditLogService.recordStandalone` pattern, used for failed logins), never a general escape hatch.

```typescript
return this.unitOfWork.execute(async () => {
  const existing = await this.getById(id); // throws NotFoundError
  const updated = await mapUniqueViolation(
    () => this.prisma.tag.update({ where: { id }, data: { name, isActive: input.isActive } }),
    duplicateTagNameError,
  );
  await this.auditLogService.record({
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.TAG,
    entityId: id,
    before: existing,
    after: updated,
  });
  return updated;
});
```

- CREATE / DELETE entries need only `action`, `entityType`, `entityId`. UPDATE-like entries pass `before` / `after`;
  `computeDiff` stores only changed fields, drops system fields and redacts `password`.
- A new action or entity type changes two enums together: Prisma (`AuditAction` / `AuditEntityType`, with a
  migration) and `packages/shared/src/dto/audit-log/request.ts`.

**Unit tests:** mock the Prisma client with `mockDatabaseClient()`, pass `createMockUnitOfWork()`, and assert placement
with `expectCalledInTx(db.tag.update)` / `expectCalledOutsideTx(auditLogService.recordStandalone)` (skill:
`unit-test-mocks`).

# Scoping records to a parent or tenant (optional pattern)

The template ships without multi-tenancy. If records must belong to a tenant (workspace, organisation, store …):

1. Add `tenantId String @db.Uuid` (+ relation) to each scoped model and make uniques composite, e.g.
   `@@unique([tenantId, name])`; numbered entities pass `tenantId` as the allocator `key`.
2. Add a middleware in `src/middlewares/` that resolves the tenant from the verified JWT (or from a header **checked
   against the user's memberships** — never trust a bare header), sets `request.tenantId`, and adds it to the audit
   request context. Register it next to `authMiddleware` in `server.ts`.
3. Add `protected getTenantId(request)` to `BaseController`; service methods take `tenantId` as the **last**
   argument and include it in **every** `where` (`getById(id, tenantId)`), raw SQL included.
4. Add `tenantId` to the `AuditLog` model, `AuditContext` and the audit DTO.
5. List the scoped vs global entities in `AGENTS.md`, and add the rule to the PRD shared conventions.
