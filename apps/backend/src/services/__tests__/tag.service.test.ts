import { ERROR_CODE } from '@repo/shared';
import { AuditAction, AuditEntityType, Tag } from '../../.generated/client';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/errorTypes';
import { createMock, createMockUnitOfWork, expectCalledInTx } from '../../__tests__/utils/mockFactory';
import { mockDatabaseClient, uniqueViolation } from '../../__tests__/utils/prismaMock';
import { AuditLogService } from '../auditLog.service';
import { TagService } from '../tag.service';

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

describe('TagService', () => {
  let db: ReturnType<typeof mockDatabaseClient>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let service: TagService;

  beforeEach(() => {
    db = mockDatabaseClient();
    auditLogService = createMock<AuditLogService>();
    service = new TagService(createMockUnitOfWork(), auditLogService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getById', () => {
    it('returns the tag', async () => {
      const tag = makeTag();
      db.tag.findUnique.mockResolvedValue(tag);

      await expect(service.getById('t1')).resolves.toBe(tag);
      expect(db.tag.findUnique).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('throws NotFoundError when missing', async () => {
      db.tag.findUnique.mockResolvedValue(null);

      await expect(service.getById('t1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('queries with search, allow-listed filters and pagination', async () => {
      db.tag.count.mockResolvedValue(1);
      db.tag.findMany.mockResolvedValue([makeTag()]);

      const result = await service.list({
        page: 2,
        pageSize: 10,
        search: 'urg',
        isActive: true,
        filters: [{ f: 'name', o: 'sw', v1: 'Ur', v2: null }],
      });

      expect(result.total).toBe(1);
      expect(db.tag.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: 'urg', mode: 'insensitive' },
          AND: [{ name: { startsWith: 'Ur', mode: 'insensitive' } }],
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
        skip: 10,
        take: 10,
      });
    });

    it('rejects filters on fields outside the allow-list', async () => {
      await expect(service.list({ filters: [{ f: 'description', o: 'eq', v1: 'x', v2: null }] })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('create', () => {
    it('allocates the running number, inserts normalised input and records CREATE in the transaction', async () => {
      db.tag.findUnique.mockResolvedValue(null);
      db.$queryRaw.mockResolvedValue([{ value: 3 }]);
      db.tag.create.mockResolvedValue(makeTag({ id: 'new' }));

      await service.create({ name: ' Tag ', description: '  ' });

      expect(db.tag.create).toHaveBeenCalledWith({
        data: { runningId: 3, runningCode: 'T000003', name: 'Tag', description: null, isActive: true },
      });
      expectCalledInTx(db.$queryRaw);
      expectCalledInTx(db.tag.create);
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.CREATE,
        entityType: AuditEntityType.TAG,
        entityId: 'new',
      });
      expectCalledInTx(auditLogService.record);
    });

    it('throws ConflictError on duplicate name and audits nothing', async () => {
      db.tag.findUnique.mockResolvedValue(makeTag());

      await expect(service.create({ name: 'Tag' })).rejects.toThrow(ConflictError);
      expect(db.tag.create).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('maps a unique violation (lost race) to the duplicate-name conflict', async () => {
      db.tag.findUnique.mockResolvedValue(null);
      db.$queryRaw.mockResolvedValue([{ value: 1 }]);
      db.tag.create.mockRejectedValue(uniqueViolation());

      await expect(service.create({ name: 'Tag' })).rejects.toMatchObject({
        errorCode: ERROR_CODE.DUPLICATE_TAG_NAME,
      });
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates only given fields and records UPDATE with before/after', async () => {
      const existing = makeTag({ isActive: true });
      const updated = makeTag({ isActive: false });
      db.tag.findUnique.mockResolvedValue(existing);
      db.tag.update.mockResolvedValue(updated);

      const result = await service.update('t1', { isActive: false });

      expect(result).toBe(updated);
      expect(db.tag.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { name: undefined, description: undefined, isActive: false },
      });
      expectCalledInTx(db.tag.update);
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.TAG,
        entityId: 't1',
        before: existing,
        after: updated,
      });
      expectCalledInTx(auditLogService.record);
    });

    it('clears the description with blank text', async () => {
      db.tag.findUnique.mockResolvedValue(makeTag({ description: 'old' }));

      await service.update('t1', { description: ' ' });

      expect(db.tag.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ description: null }) }),
      );
    });

    it('allows keeping its own name', async () => {
      db.tag.findUnique.mockResolvedValue(makeTag());

      await service.update('t1', { name: 'Tag' });

      expect(db.tag.update).toHaveBeenCalled();
    });

    it('throws NotFoundError', async () => {
      db.tag.findUnique.mockResolvedValue(null);

      await expect(service.update('t1', {})).rejects.toThrow(NotFoundError);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('throws ConflictError when another tag has the name', async () => {
      db.tag.findUnique.mockResolvedValueOnce(makeTag()).mockResolvedValueOnce(makeTag({ id: 'other' }));

      await expect(service.update('t1', { name: 'Taken' })).rejects.toThrow(ConflictError);
      expect(db.tag.update).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('maps a unique violation (lost race) to the duplicate-name conflict', async () => {
      db.tag.findUnique.mockResolvedValueOnce(makeTag()).mockResolvedValueOnce(null);
      db.tag.update.mockRejectedValue(uniqueViolation());

      await expect(service.update('t1', { name: 'Dup' })).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
