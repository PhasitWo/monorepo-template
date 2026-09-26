import { Prisma } from '../../.generated/client';
import { DatabaseClient } from '../../common/database/databaseClient';

export type ModelMock = Record<'findUnique' | 'findMany' | 'count' | 'create' | 'update' | 'deleteMany', jest.Mock>;

const model = (): ModelMock => ({
  findUnique: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deleteMany: jest.fn(),
});

/**
 * Points DatabaseClient.getInstance() at a fake client of jest.fn() model methods, for repository unit tests.
 * Call it in beforeEach and `jest.restoreAllMocks()` in afterEach.
 */
export function mockDatabaseClient() {
  const client = {
    tag: model(),
    user: model(),
    refreshToken: model(),
    auditLog: model(),
    $queryRaw: jest.fn(),
  };
  jest
    .spyOn(DatabaseClient, 'getInstance')
    .mockReturnValue(client as unknown as ReturnType<typeof DatabaseClient.getInstance>);
  return client;
}

export const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
