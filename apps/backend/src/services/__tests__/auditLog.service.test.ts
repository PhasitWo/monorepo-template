import { AuditAction, AuditEntityType, Prisma } from '../../.generated/client';
import { AuditContext } from '../../common/context/auditContext';
import { TransactionContext } from '../../common/database/transactionContext';
import { PrismaTxClient } from '../../common/database/types';
import { mockDatabaseClient } from '../../__tests__/utils/prismaMock';
import { AuditLogService } from '../auditLog.service';

const CONTEXT = {
  actorUserId: 'u1',
  actorUsername: 'alice',
  ip: '127.0.0.1',
  userAgent: 'jest',
  requestId: 'req-1',
};

describe('AuditLogService', () => {
  let db: ReturnType<typeof mockDatabaseClient>;
  let getContext: jest.Mock<AuditContext, []>;
  let service: AuditLogService;

  beforeEach(() => {
    db = mockDatabaseClient();
    getContext = jest.fn().mockReturnValue(CONTEXT);
    service = new AuditLogService(getContext);
  });

  afterEach(() => jest.restoreAllMocks());

  const written = () => db.auditLog.create.mock.calls[0][0].data;

  describe('list', () => {
    beforeEach(() => {
      db.auditLog.count.mockResolvedValue(1);
      db.auditLog.findMany.mockResolvedValue([{ id: 'a1' }]);
    });

    it('defaults to newest first with pagination and filter transforms', async () => {
      const result = await service.list({
        page: 2,
        pageSize: 10,
        filters: [
          { f: 'action', o: 'eq', v1: 'DELETE', v2: null },
          { f: 'entityId', o: 'eq', v1: 't1', v2: null },
        ],
      });

      expect(result).toEqual({ total: 1, data: [{ id: 'a1' }] });
      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: { AND: [{ action: 'DELETE' }, { entityId: 't1' }] },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    it('returns everything when all=true and honours sort order', async () => {
      await service.list({ all: true, sortBy: 'createdAt', sortOrder: 'asc' });

      expect(db.auditLog.findMany).toHaveBeenCalledWith({ where: {}, orderBy: { createdAt: 'asc' } });
    });

    it('rejects unsupported filter fields', async () => {
      await expect(service.list({ filters: [{ f: 'ip', o: 'eq', v1: 'x', v2: null }] })).rejects.toThrow(
        'Unsupported filter field: ip',
      );
    });
  });

  describe('record', () => {
    it('writes a row with the request context, storing null JSON as DbNull', async () => {
      await service.record({ action: AuditAction.CREATE, entityType: AuditEntityType.TAG, entityId: 't1' });

      expect(written()).toEqual({
        action: AuditAction.CREATE,
        entityType: AuditEntityType.TAG,
        entityId: 't1',
        diff: Prisma.DbNull,
        metadata: Prisma.DbNull,
        ...CONTEXT,
      });
    });

    it('joins the ambient transaction', async () => {
      const txAuditLog = { create: jest.fn() };

      await TransactionContext.run({ auditLog: txAuditLog } as unknown as PrismaTxClient, () =>
        service.record({ action: AuditAction.CREATE, entityType: null, entityId: null }),
      );

      expect(txAuditLog.create).toHaveBeenCalledTimes(1);
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });

    it('computes a diff when before and after are given', async () => {
      await service.record({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.TAG,
        entityId: 't1',
        before: { name: 'a', updatedAt: new Date(1) },
        after: { name: 'b', updatedAt: new Date(2) },
      });

      expect(written().diff).toEqual({ name: ['a', 'b'] });
    });

    it('diffs without entity-specific exclusions when entityType is null', async () => {
      await service.record({
        action: AuditAction.UPDATE,
        entityType: null,
        entityId: null,
        before: { ownerName: 'x' },
        after: { ownerName: 'y' },
      });

      expect(written().diff).toEqual({ ownerName: ['x', 'y'] });
    });

    it('uses the explicit actor over the context', async () => {
      await service.record({
        action: AuditAction.LOGIN_SUCCESS,
        entityType: AuditEntityType.USER,
        entityId: 'u9',
        actor: { userId: 'u9', username: 'bob' },
      });

      expect(written()).toMatchObject({ actorUserId: 'u9', actorUsername: 'bob', ip: '127.0.0.1' });
    });

    it('fills nulls when there is no request context', async () => {
      getContext.mockReturnValue({});

      await service.record({ action: AuditAction.CREATE, entityType: null, entityId: null });

      expect(written()).toMatchObject({
        actorUserId: null,
        actorUsername: null,
        ip: null,
        userAgent: null,
        requestId: null,
      });
    });

    it('rejects when the write fails', async () => {
      db.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(service.record({ action: AuditAction.CREATE, entityType: null, entityId: null })).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('recordStandalone', () => {
    it('writes via the root client even inside a transaction, so the row survives a rollback', async () => {
      const txAuditLog = { create: jest.fn() };

      await TransactionContext.run({ auditLog: txAuditLog } as unknown as PrismaTxClient, () =>
        service.recordStandalone({
          action: AuditAction.LOGIN_FAILURE,
          entityType: null,
          entityId: null,
          metadata: { reason: 'UNKNOWN_USER' },
          actor: { userId: null, username: 'ghost' },
        }),
      );

      expect(txAuditLog.create).not.toHaveBeenCalled();
      expect(written()).toMatchObject({
        action: AuditAction.LOGIN_FAILURE,
        actorUserId: null,
        actorUsername: 'ghost',
        metadata: { reason: 'UNKNOWN_USER' },
      });
    });

    it('swallows write errors', async () => {
      db.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.recordStandalone({ action: AuditAction.LOGIN_FAILURE, entityType: null, entityId: null }),
      ).resolves.toBeUndefined();
    });
  });
});
