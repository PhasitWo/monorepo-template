# Service Examples

Canonical files (`apps/backend/src/services/`):

- `tag.service.ts` — get / list / create / update, running number, unique name
- `user.service.ts` — soft delete with dependent cleanup, a secret column kept out of every result (`omit`), slow work
  (hashing) kept outside the transaction, nullable `findX` lookups for other services
- `auth.service.ts` — depends on another service (`UserService`), `recordStandalone` for failures that must survive the
  thrown error, a private helper called inside the unit of work
- `auditLog.service.ts` — the audit writer every service uses; a root-client write (`this.rootPrisma`), JSON columns
- `baseService.ts` — `this.prisma`, `this.rootPrisma`, `pageArgs`, `transformToWhereClause` + the per-kind filter
  transforms, `ListParams`, `ListResult`

Services are the only place that runs Prisma queries. They return the Prisma-generated types — no entity classes, no
mapping.

## Shape

```typescript
import { AuditAction, AuditEntityType, Prisma, Tag } from '../.generated/client';

export interface ListTagParams extends ListParams {
  search?: string;
  isActive?: boolean;
}

// one factory for both the pre-check and the unique-violation mapping, so both give the same 409
const duplicateTagNameError = () =>
  new ConflictError('Duplicate tag name', undefined, { code: ERROR_CODE.DUPLICATE_TAG_NAME });

export class TagService extends BaseService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogService: AuditLogService,
  ) {
    super();
  }
  // ...
}
```

## READ — throw NotFoundError

```typescript
async getById(id: string): Promise<Tag> {
  const tag = await this.prisma.tag.findUnique({ where: { id } }); // this.prisma joins the active unit of work
  if (!tag) {
    throw new NotFoundError('Tag not found');
  }
  return tag;
}
```

Other methods reuse `getById` whenever they need "load or 404". When another service needs a nullable lookup, add a
public `findX` returning `null` (see `UserService.findById` / `findByUsername`).

## LIST — search, allow-listed filters, paging

```typescript
async list(params: ListTagParams): Promise<ListResult<Tag>> {
  const { sortBy = 'createdAt', sortOrder = 'asc', search, filters, isActive } = params;
  const searchWhere: Prisma.TagWhereInput | undefined = search
    ? { name: { contains: search, mode: 'insensitive' } }
    : undefined;
  // allow-list: only these fields can be filtered, each with its operator set
  const filterWhere = this.transformToWhereClause<Tag>(filters, {
    runningId: this.transformToNumberWhereClause,
    name: this.transformToStringWhereClause,
    isActive: this.transformToDropdownWhereClause,
    createdAt: this.transformToDateWhereClause,
  });
  const where = { ...searchWhere, ...filterWhere, isActive };
  const [total, data] = await Promise.all([
    this.prisma.tag.count({ where }),
    this.prisma.tag.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...this.pageArgs(params) }),
  ]);
  return { total, data };
}
```

`sortBy` values come from the query schema's `z.enum`, so they are always real column names.

## CREATE — normalise, pre-check, then running number + insert + audit in one unit of work

```typescript
async create(input: CreateTagBody): Promise<Tag> {
  const name = input.name.trim();
  // friendly pre-check; mapUniqueViolation turns the race where two creates both pass it into the same error
  if (await this.prisma.tag.findUnique({ where: { name } })) {
    throw duplicateTagNameError();
  }

  return this.unitOfWork.execute(async () => {
    // allocated in the same transaction as the insert, so a rollback hands the number back
    const runningId = await allocateRunningNumber(this.prisma, RunningNumberScope.TAG);
    const created = await mapUniqueViolation(
      () =>
        this.prisma.tag.create({
          data: {
            runningId,
            runningCode: `T${runningId.toString().padStart(6, '0')}`,
            name,
            description: normalizeDescription(input.description), // '' → null
            isActive: true,
          },
        }),
      duplicateTagNameError,
    );
    await this.auditLogService.record({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.TAG,
      entityId: created.id,
    });
    return created;
  });
}
```

## UPDATE — load, check, write, audit before/after

```typescript
async update(id: string, input: UpdateTagBody): Promise<Tag> {
  return this.unitOfWork.execute(async () => {
    const existing = await this.getById(id);
    const name = input.name?.trim();
    if (name !== undefined) {
      const sameName = await this.prisma.tag.findUnique({ where: { name } });
      if (sameName && sameName.id !== id) {
        throw duplicateTagNameError();
      }
    }
    // undefined = leave unchanged; Prisma skips undefined fields
    const updated = await mapUniqueViolation(
      () =>
        this.prisma.tag.update({
          where: { id },
          data: {
            name,
            description: input.description === undefined ? undefined : normalizeDescription(input.description),
            isActive: input.isActive,
          },
        }),
      duplicateTagNameError,
    );
    await this.auditLogService.record({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.TAG,
      entityId: id,
      before: existing, // the loaded row
      after: updated, // the row Prisma returned — a different object, so no snapshot is needed
    });
    return updated;
  });
}
```

## DELETE — check existence first, clean up dependents in the same transaction

```typescript
async delete(id: string): Promise<void> {
  await this.unitOfWork.execute(async () => {
    await this.getById(id);
    await this.prisma.user.update({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } }); // soft delete
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } }); // end every session
    await this.auditLogService.record({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.USER,
      entityId: id,
    });
  });
}
```

## Secrets: omit on every query, one dedicated reader

```typescript
export type SafeUser = Omit<User, 'password'>;
const omitPassword = { password: true } as const;

findById(id: string): Promise<SafeUser | null> {
  return this.prisma.user.findUnique({ where: { id, deletedAt: null }, omit: omitPassword });
}

async findPasswordByUsername(username: string): Promise<string | null> {
  const user = await this.prisma.user.findUnique({ where: { username, deletedAt: null }, select: { password: true } });
  return user?.password ?? null;
}
```

## Failures that must be recorded anyway

A thrown error rolls back the unit of work, so an audit row written with `record()` would vanish. For events whose
whole point is the failure (a wrong password), use `recordStandalone()` outside `execute` — it writes on the root
client and never throws:

```typescript
await this.auditLogService.recordStandalone({
  action: AuditAction.LOGIN_FAILURE,
  entityType: userId ? AuditEntityType.USER : null,
  entityId: userId ?? null,
  metadata: { reason }, // never the password
  actor: { userId: null, username },
});
throw new UnauthorizedError('Invalid username or password');
```
