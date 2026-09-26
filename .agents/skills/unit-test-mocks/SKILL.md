---
name: unit-test-mocks
description: Use when creating backend unit tests — services (mocking the Prisma client, the unit of work and other services), controllers (mocking the service) and middlewares. Provides the Prisma client mock, the class mock factory, transaction-placement assertions, and patterns that don't break when classes gain methods.
---

# Overview

Services query Prisma directly, so a service unit test mocks three things:

1. **The Prisma client** — `mockDatabaseClient()` points `DatabaseClient.getInstance()` (what `this.prisma` falls back
   to) at `jest.fn()` model methods
2. **The unit of work** — `createMockUnitOfWork()` runs the callback immediately and records its window, so tests can
   assert a query happened **inside** (or outside) the transaction
3. **Collaborating services** — `createMock<AuditLogService>()` auto-stubs every method on first access, so tests only
   set up what they use and don't break when the class gains a method

There are no interfaces in this backend: mock the concrete class type (`jest.Mocked<UserService>`) and pass the mock to
the constructor.

# Where tests and helpers live

- Unit tests sit in a `__tests__/` folder beside the code: `services/tag.service.ts` →
  `services/__tests__/tag.service.test.ts`. Same for `controllers/`, `routes/`, `middlewares/` and `common/*/`.
- Jest only runs `**/__tests__/**/*.test.ts` — helper files inside `__tests__/` must not end in `.test.ts`.
- `apps/backend/src/__tests__/utils/`:
  - `prismaMock.ts` — `mockDatabaseClient()`, `uniqueViolation()`
  - `mockFactory.ts` — `createMock`, `createMockUnitOfWork`, `expectCalledInTx`, `expectCalledOutsideTx` (copy from
    [references/mockFactory.ts](./references/mockFactory.ts) if missing)
  - `http.ts` — `makeRequest`, `makeReply`, `sent` for controller and middleware tests

From a test in `apps/backend/src/services/__tests__/`:

```typescript
import { createMock, createMockUnitOfWork, expectCalledInTx } from '../../__tests__/utils/mockFactory';
import { mockDatabaseClient, uniqueViolation } from '../../__tests__/utils/prismaMock';
```

Canonical example: `apps/backend/src/services/__tests__/tag.service.test.ts`.

# Services

```typescript
describe('TagService', () => {
  let db: ReturnType<typeof mockDatabaseClient>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let service: TagService;

  beforeEach(() => {
    db = mockDatabaseClient();
    auditLogService = createMock<AuditLogService>();
    service = new TagService(createMockUnitOfWork(), auditLogService);
  });

  afterEach(() => jest.restoreAllMocks()); // undoes the DatabaseClient spy

  it('inserts, and records CREATE, inside the transaction', async () => {
    db.tag.findUnique.mockResolvedValue(null); // pre-check: name is free
    db.$queryRaw.mockResolvedValue([{ value: 3 }]); // running-number allocator
    db.tag.create.mockResolvedValue(makeTag({ id: 'new' }));

    await service.create({ name: ' Tag ' });

    expect(db.tag.create).toHaveBeenCalledWith({
      data: { runningId: 3, runningCode: 'T000003', name: 'Tag', description: null, isActive: true },
    });
    expectCalledInTx(db.tag.create);
    expect(auditLogService.record).toHaveBeenCalledWith({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.TAG,
      entityId: 'new',
    });
    expectCalledInTx(auditLogService.record);
  });

  it('maps a lost unique race to the duplicate 409 and audits nothing', async () => {
    db.tag.findUnique.mockResolvedValue(null);
    db.$queryRaw.mockResolvedValue([{ value: 1 }]);
    db.tag.create.mockRejectedValue(uniqueViolation());

    await expect(service.create({ name: 'Tag' })).rejects.toMatchObject({ errorCode: ERROR_CODE.DUPLICATE_TAG_NAME });
    expect(auditLogService.record).not.toHaveBeenCalled();
  });
});
```

- Assert the **Prisma arguments** for anything that matters (`where` filters such as `deletedAt: null`, `omit`, paging),
  the **business outcome** (errors, return value), and **placement** (writes and audit inside the transaction).
- Several calls to the same model method: queue results with `mockResolvedValueOnce(...)` in call order (e.g.
  `getById`'s lookup, then the duplicate-name check), and check them with `toHaveBeenNthCalledWith`.
- A new model used by a service → add it to `mockDatabaseClient()` in `prismaMock.ts`.
- Services that depend on other services mock them: `AuthService` gets `createMock<UserService>()`, so
  `userService.findById.mockResolvedValue(user)`.
- Constructor-injected functions are plain `jest.fn()`: `new AuditLogService(jest.fn().mockReturnValue(context))`.

## Transaction placement

- `expectCalledInTx(mock, callIndex = 0)` — the nth call happened inside `unitOfWork.execute()`
- `expectCalledOutsideTx(mock, callIndex = 0)` — it happened outside every `execute()` (e.g.
  `auditLogService.recordStandalone` for a failed login, which must survive the rollback)

Works for any `jest.fn()` — Prisma model methods, `$queryRaw`, and mocked services alike. Always assert writes **and**
the audit entry are in the transaction, and that nothing is audited on failure.

`createMockUnitOfWork()` does not set up `TransactionContext`, so `this.prisma` resolves to the mocked root client
inside and outside `execute()`. To test that code really joins the ambient transaction or escapes it (root client),
run it inside `TransactionContext.run(fakeTx, …)` — see `services/__tests__/auditLog.service.test.ts`.

## Test data

Records are plain Prisma-shaped objects — build them with a local `make<X>(overrides)` helper typed by the Prisma
model (or the service's narrowed type, e.g. `SafeUser`):

```typescript
const makeTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 't1',
  runningId: 1,
  runningCode: 'T000001',
  name: 'Tag',
  description: null,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});
```

# Controllers

Mock the service and use the HTTP helpers — see `controllers/__tests__/tag.controller.test.ts`:

```typescript
const service = createMock<TagService>();
service.getById.mockResolvedValue(makeTag());
const reply = makeReply();

await new TagController(service).getTagById(makeRequest({ params: { id: 't1' } }), reply);

expect(sent(reply).data).toMatchObject({ id: 't1', createdAt: '2024-01-01T00:00:00.000Z' });
```

Overrides can also be passed up front: `createMock<AuthService>({ login: jest.fn().mockResolvedValue(tokens) })`.

# Integration tests

Behaviour that depends on real SQL (locks, unique races, running numbers, `omit` really dropping a column) belongs in
`src/__tests__/integration/*.int.test.ts` — real Postgres via Testcontainers, run with
`npm run test:integration -w @app/backend`. Build real services with the shared `unitOfWork` and `auditLogService`
from `__tests__/integration/helpers.ts`, and add new tables to `resetDb()` there.

# Gotchas

- `jest.Mocked<SomeClass>` covers public members only — test through the public API.
- Forgetting `afterEach(() => jest.restoreAllMocks())` leaks the `DatabaseClient` spy into later tests in the file.
- ts-jest reports type errors only as warnings — read the jest output for `TS` diagnostics; a green run can hide them.
- `__tests__/` folders are excluded from ESLint and `tsconfig.json`.
