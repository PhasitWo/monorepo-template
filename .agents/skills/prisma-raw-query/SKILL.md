---
name: prisma-raw-query
description: Use when writing Prisma raw SQL queries ($queryRaw, $executeRaw) in the backend, to get table/column names, quoting, casts and transaction handling right.
---

# Prisma Raw Query Skill

Raw SQL is the exception — prefer the Prisma query API. Reach for raw SQL only when Prisma can't express the
operation: atomic upserts that return a value, `SELECT … FOR UPDATE` row locks, CTEs/window functions, JSONB
operators, bulk updates with computed values.

## When to Use

- Writing `$queryRaw` / `$executeRaw` in a service (`apps/backend/src/services/*.service.ts`) or in
  `apps/backend/src/common/database/`
- Debugging "relation does not exist" / "column does not exist" errors from raw queries

## Names: quote the Prisma names exactly

Schema: `apps/backend/prisma/schema.prisma`. It uses **no** `@map` / `@@map`, so the database names are the Prisma
model and field names verbatim — **PascalCase tables, camelCase columns**. Postgres folds unquoted identifiers to
lowercase, so **every table and column must be double-quoted**.

```sql
-- ✅ correct
SELECT 1 FROM "Tag" WHERE "id" = ${id}::uuid FOR UPDATE

-- ❌ wrong: unquoted → looks for table tag / column isactive
SELECT 1 FROM Tag WHERE id = ${id} AND isActive = true

-- ❌ wrong: snake_case names don't exist in this schema
SELECT 1 FROM tags WHERE is_active = true
```

If a model ever gains `@@map("...")` / `@map("...")`, use the mapped name instead — check the model before writing
SQL. (If you adopt a snake_case convention for a new project, add `@map` / `@@map` everywhere and update this skill
and `AGENTS.md` together.)

## Casts

- `uuid` columns (`@db.Uuid`): cast parameters with `::uuid`.
- Prisma enums are Postgres enum types named after the enum, also quoted: `${scope}::"RunningNumberScope"`.
- Timestamps are `timestamptz`; pass `Date` objects.

## Client and transactions

Always run raw SQL on the service's ambient client, `this.prisma` (from `BaseService`), so it joins the
active `unitOfWork.execute()` transaction. Row locks (`FOR UPDATE`) and the running-number counter only work inside
that transaction. Helpers outside a service take the client as a parameter (`client: PrismaDBClient`), as
`allocateRunningNumber` does.

Import `Prisma` from the generated client (`'../../.generated/client'`), never from `@prisma/client`.

## Patterns

Atomic upsert returning a value — `common/database/runningNumberAllocator.ts` (real code):

```typescript
const rows = await client.$queryRaw<{ value: number }[]>`
  INSERT INTO "RunningNumber" ("scope", "key", "value")
  VALUES (${scope}::"RunningNumberScope", ${normalizedKey}, 1)
  ON CONFLICT ("scope", "key") DO UPDATE SET "value" = "RunningNumber"."value" + 1
  RETURNING "value"`;
return rows[0].value;
```

Row lock — serialize work on one record for the rest of the transaction:

```typescript
async lockById(id: string): Promise<void> {
  await this.prisma.$queryRaw`SELECT 1 FROM "Tag" WHERE "id" = ${id}::uuid FOR UPDATE`;
}
```

Conditional fragments:

```typescript
const excludeClause = excludeId ? Prisma.sql`AND "id" <> ${excludeId}::uuid` : Prisma.empty;
const rows = await this.prisma.$queryRaw<{ id: string }[]>`
  SELECT "id" FROM "Tag" WHERE "isActive" = true ${excludeClause}`;
```

Truncating tables in integration tests is the one accepted `$executeRawUnsafe` use — a constant string with no
input (`__tests__/integration/helpers.ts`).

## Common Mistakes

1. **Unquoted identifiers** — `FROM Tag` → `FROM "Tag"`; `isActive` → `"isActive"`.
2. **Missing `::uuid` / enum casts** — Postgres won't compare `uuid` or enum columns to `text` parameters.
3. **String interpolation** — never `$queryRawUnsafe` or `` `... '${id}'` `` with input; use the tagged template so
   values become bind parameters.
4. **Using the root client** — `DatabaseClient.getInstance()` in a service escapes the unit of work; locks and
   rollbacks then silently do nothing.
5. **Forgetting scope filters** — soft-deleted rows (`"deletedAt" IS NULL`) and, if you add tenancy, the tenant
   column must be filtered in raw SQL too; Prisma's query API won't do it for you here.

## Verification Checklist

- [ ] Every table and column is double-quoted and spelled exactly as in `schema.prisma`
- [ ] `::uuid` on uuid params, `::"EnumName"` on enum params
- [ ] Tagged template (`$queryRaw\`...\``/ `Prisma.sql`), `Prisma.empty` for optional fragments
- [ ] Runs on `this.prisma` (or a passed-in `PrismaDBClient`)
- [ ] Result typed: `$queryRaw<Row[]>`
- [ ] Behaviour that depends on SQL semantics (locks, conflicts) is covered by an integration test in
      `apps/backend/src/__tests__/integration/`
