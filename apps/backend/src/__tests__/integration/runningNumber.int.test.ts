import { DatabaseClient } from '../../common/database/databaseClient';
import { TagService } from '../../services/tag.service';
import {
  auditLogService,
  concurrently,
  fulfilled,
  prisma,
  range,
  rejected,
  resetDb,
  sortedIds,
  unitOfWork,
} from './helpers';

const tagService = new TagService(unitOfWork, auditLogService);

const N = 20;

describe('running numbers under concurrency', () => {
  beforeEach(resetDb);
  afterAll(() => DatabaseClient.disconnect());

  it('concurrent creates get 1..N with no collision', async () => {
    const results = await concurrently(N, (i) => tagService.create({ name: `tag ${i}` }));

    expect(rejected(results)).toEqual([]);
    expect(sortedIds(fulfilled(results))).toEqual(range(1, N));
    const codes = fulfilled(results).map((t) => t.runningCode);
    expect(new Set(codes).size).toBe(N);
    expect(codes).toContain('T000001');
  });

  it('a create that rolls back after allocating does not leave a gap', async () => {
    await tagService.create({ name: 'one' });

    await expect(
      unitOfWork.execute(async () => {
        await tagService.create({ name: 'rolled back' }); // joins this outer transaction
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const next = await tagService.create({ name: 'two' });
    expect(next.runningId).toBe(2);
    expect(await prisma().tag.count({ where: { name: 'rolled back' } })).toBe(0);
    expect(await prisma().auditLog.count()).toBe(2);
  });

  it('writes the CREATE audit row in the same transaction', async () => {
    const tag = await tagService.create({ name: 'audited' });

    const rows = await prisma().auditLog.findMany({ where: { entityId: tag.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'CREATE', entityType: 'TAG' });
  });

  it('writes an UPDATE audit row with only the changed fields', async () => {
    const tag = await tagService.create({ name: 'before' });

    await tagService.update(tag.id, { name: 'after', isActive: true });

    const row = await prisma().auditLog.findFirst({ where: { entityId: tag.id, action: 'UPDATE' } });
    expect(row?.diff).toEqual({ name: ['before', 'after'] });
  });
});
