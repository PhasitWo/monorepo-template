import { ERROR_CODE } from '@repo/shared';
import { AuditAction, AuditEntityType } from '../../.generated/client';
import { ConflictError, NotFoundError } from '../../common/errors/errorTypes';
import { createMock, createMockUnitOfWork, expectCalledInTx } from '../../__tests__/utils/mockFactory';
import { mockDatabaseClient, uniqueViolation } from '../../__tests__/utils/prismaMock';
import { AuditLogService } from '../auditLog.service';
import { SafeUser, UserService } from '../user.service';

const makeUser = (overrides: Partial<SafeUser> = {}): SafeUser => ({
  id: 'u1',
  username: 'alice01',
  name: 'Alice',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
  ...overrides,
});
const omit = { password: true };

describe('UserService', () => {
  let db: ReturnType<typeof mockDatabaseClient>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let service: UserService;

  beforeEach(() => {
    db = mockDatabaseClient();
    auditLogService = createMock<AuditLogService>();
    service = new UserService(createMockUnitOfWork(), auditLogService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('reads', () => {
    it('reads only non-deleted users and never selects the password', async () => {
      db.user.findUnique.mockResolvedValue(makeUser());

      await service.findByUsername('alice01');
      await service.getById('u1');

      expect(db.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { username: 'alice01', deletedAt: null },
        omit,
      });
      expect(db.user.findUnique).toHaveBeenNthCalledWith(2, { where: { id: 'u1', deletedAt: null }, omit });
    });

    it('getById throws NotFoundError when missing', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.getById('u1')).rejects.toThrow(NotFoundError);
    });

    it('returns the password hash only through findPasswordByUsername', async () => {
      db.user.findUnique.mockResolvedValueOnce({ password: 'hash' }).mockResolvedValueOnce(null);

      await expect(service.findPasswordByUsername('alice01')).resolves.toBe('hash');
      await expect(service.findPasswordByUsername('ghost')).resolves.toBeNull();
    });

    it('lists by name or username search', async () => {
      db.user.count.mockResolvedValue(0);
      db.user.findMany.mockResolvedValue([]);

      await service.list({ all: true, search: 'ali', sortBy: 'username', sortOrder: 'desc' });

      expect(db.user.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: 'ali', mode: 'insensitive' } },
            { username: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
        omit,
        orderBy: { username: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('stores a hash, records CREATE, and never passes the password to the audit log', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue(makeUser({ id: 'new' }));

      await service.create({ name: ' Alice ', username: 'alice01', password: 'super-secret' });

      expectCalledInTx(db.user.create);
      const { data, omit: omitArg } = db.user.create.mock.calls[0][0];
      expect(data).toMatchObject({ username: 'alice01', name: 'Alice' });
      expect(data.password).not.toBe('super-secret');
      expect(omitArg).toEqual(omit);
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.CREATE,
        entityType: AuditEntityType.USER,
        entityId: 'new',
      });
      expectCalledInTx(auditLogService.record);
      expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain('super-secret');
    });

    it('throws ConflictError when the username is taken', async () => {
      db.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.create({ name: 'A', username: 'alice01', password: 'password1' })).rejects.toThrow(
        ConflictError,
      );
      expect(db.user.create).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('maps a unique violation (lost race, or a soft-deleted user) to the duplicate conflict', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockRejectedValue(uniqueViolation());

      await expect(service.create({ name: 'A', username: 'alice01', password: 'password1' })).rejects.toMatchObject({
        errorCode: ERROR_CODE.DUPLICATE_USERNAME,
      });
    });
  });

  describe('update', () => {
    it('records UPDATE with the before and after records', async () => {
      db.user.findUnique.mockResolvedValue(makeUser({ name: 'Alice' }));
      db.user.update.mockResolvedValue(makeUser({ name: 'Alicia' }));

      const result = await service.update('u1', { name: 'Alicia' });

      expect(result.name).toBe('Alicia');
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'u1', deletedAt: null },
        data: { name: 'Alicia' },
        omit,
      });
      expectCalledInTx(db.user.update);
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.USER,
        entityId: 'u1',
        before: expect.objectContaining({ name: 'Alice' }),
        after: expect.objectContaining({ name: 'Alicia' }),
      });
      expectCalledInTx(auditLogService.record);
    });

    it('throws NotFoundError and writes no audit row', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'Bob' })).rejects.toThrow(NotFoundError);
      expect(db.user.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('propagates an audit write failure', async () => {
      db.user.findUnique.mockResolvedValue(makeUser());
      db.user.update.mockResolvedValue(makeUser());
      auditLogService.record.mockRejectedValue(new Error('db down'));

      await expect(service.update('u1', { name: 'X' })).rejects.toThrow('db down');
    });
  });

  describe('delete', () => {
    it('soft-deletes, revokes sessions and records DELETE in one transaction', async () => {
      db.user.findUnique.mockResolvedValue(makeUser());

      await service.delete('u1');

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'u1', deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      });
      expectCalledInTx(db.user.update);
      expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expectCalledInTx(db.refreshToken.deleteMany);
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.DELETE,
        entityType: AuditEntityType.USER,
        entityId: 'u1',
      });
      expectCalledInTx(auditLogService.record);
    });

    it('throws NotFoundError and writes nothing', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundError);
      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.refreshToken.deleteMany).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
});
