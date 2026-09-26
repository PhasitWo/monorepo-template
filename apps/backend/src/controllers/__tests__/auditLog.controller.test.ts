import { AuditLog } from '../../.generated/client';
import { ValidationError } from '../../common/errors/errorTypes';
import { makeReply, makeRequest, sent } from '../../__tests__/utils/http';
import { createMock } from '../../__tests__/utils/mockFactory';
import { AuditLogController } from '../auditLog.controller';
import { AuditLogService } from '../../services/auditLog.service';

describe('AuditLogController', () => {
  const log: AuditLog = {
    id: 'a1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    action: 'DELETE',
    entityType: 'USER',
    entityId: 'u1',
    diff: null,
    metadata: null,
    actorUserId: 'u2',
    actorUsername: 'alice',
    ip: '::1',
    userAgent: 'jest',
    requestId: 'r1',
  };
  let service: jest.Mocked<AuditLogService>;
  let controller: AuditLogController;

  beforeEach(() => {
    service = createMock<AuditLogService>();
    service.list.mockResolvedValue({ total: 3, data: [log] });
    controller = new AuditLogController(service);
  });

  it('returns a paginated response with ISO dates and parsed filters', async () => {
    const filters = [{ f: 'action', o: 'eq', v1: 'DELETE', v2: null }];
    const reply = makeReply();

    await controller.listAuditLogs(
      makeRequest({ query: { page: '2', pageSize: '1', sortOrder: 'asc', filters: JSON.stringify(filters) } }),
      reply,
    );

    expect(service.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 1,
      sortBy: undefined,
      sortOrder: 'asc',
      all: false,
      filters,
    });
    const body = sent(reply);
    expect(body.data[0]).toMatchObject({ id: 'a1', createdAt: '2026-01-01T00:00:00.000Z', action: 'DELETE' });
    expect(body.meta.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3, hasNext: true, hasPrev: true });
  });

  it('returns a plain list when all=true', async () => {
    const reply = makeReply();

    await controller.listAuditLogs(makeRequest({ query: { all: 'true' } }), reply);

    const body = sent(reply);
    expect(body.meta).toBeUndefined();
    expect(body.data).toHaveLength(1);
  });

  it('rejects malformed filters with a ValidationError', async () => {
    await expect(
      controller.listAuditLogs(makeRequest({ query: { filters: '{not json' } }), makeReply()),
    ).rejects.toThrow(ValidationError);
  });
});
