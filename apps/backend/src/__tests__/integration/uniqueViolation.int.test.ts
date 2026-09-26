import { ERROR_CODE } from '@repo/shared';
import { DatabaseClient } from '../../common/database/databaseClient';
import { ConflictError } from '../../common/errors/errorTypes';
import { TagService } from '../../services/tag.service';
import { UserService } from '../../services/user.service';
import { auditLogService, concurrently, fulfilled, prisma, rejected, resetDb, unitOfWork } from './helpers';

const tagService = new TagService(unitOfWork, auditLogService);
const userService = new UserService(unitOfWork, auditLogService);

const expectConflict = (err: unknown, code: ERROR_CODE) => {
  expect(err).toBeInstanceOf(ConflictError);
  expect(err).toMatchObject({ statusCode: 409, errorCode: code });
};

// Concurrent requests all pass the service's pre-check before any commits, so these exercise the
// database-level unique-violation mapping — every loser must get the duplicate 409, never a 500.
describe('unique-constraint races map to the duplicate ConflictError', () => {
  beforeEach(resetDb);
  afterAll(() => DatabaseClient.disconnect());

  it('tag name on create', async () => {
    const results = await concurrently(5, () => tagService.create({ name: 'Same' }));

    expect(fulfilled(results)).toHaveLength(1);
    rejected(results).forEach((e) => expectConflict(e, ERROR_CODE.DUPLICATE_TAG_NAME));
  });

  it('tag name on update', async () => {
    const [a, b] = await Promise.all([tagService.create({ name: 'A' }), tagService.create({ name: 'B' })]);

    const results = await Promise.allSettled([
      tagService.update(a.id, { name: 'Dup' }),
      tagService.update(b.id, { name: 'Dup' }),
    ]);

    expect(fulfilled(results)).toHaveLength(1);
    expectConflict(rejected(results)[0], ERROR_CODE.DUPLICATE_TAG_NAME);
  });

  it('username, including a soft-deleted user', async () => {
    const input = { username: 'alice01', name: 'Alice', password: 'password123' };
    const results = await concurrently(2, () => userService.create(input));
    expect(fulfilled(results)).toHaveLength(1);
    expectConflict(rejected(results)[0], ERROR_CODE.DUPLICATE_USERNAME);

    // a deleted user is invisible to the pre-check but still holds the username
    await userService.delete(fulfilled(results)[0].id);
    await expect(userService.create(input)).rejects.toMatchObject({ errorCode: ERROR_CODE.DUPLICATE_USERNAME });
  });

  it('the service never returns the password hash', async () => {
    const created = await userService.create({ username: 'bob01', name: 'Bob', password: 'password123' });

    expect(created).not.toHaveProperty('password');
    expect(await userService.getById(created.id)).not.toHaveProperty('password');
    expect((await userService.list({ all: true })).data[0]).not.toHaveProperty('password');
    const hash = await userService.findPasswordByUsername('bob01');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect((await prisma().user.findUnique({ where: { id: created.id } }))?.password).toBe(hash);
  });
});
