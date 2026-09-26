import { FastifyReply, FastifyRequest } from 'fastify';
import { AuditLogResponse, ListAuditLogQuery, ListAuditLogResponse } from '@repo/shared';
import { AuditLog } from '../.generated/client';
import { BaseController } from './baseController';
import { AuditLogService } from '../services/auditLog.service';
import { AuditDiff } from '../common/utils/computeDiff';

function mapToAuditLogResponse(log: AuditLog): AuditLogResponse {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    diff: log.diff as AuditDiff | null,
    metadata: log.metadata as Record<string, unknown> | null,
    actorUserId: log.actorUserId,
    actorUsername: log.actorUsername,
    ip: log.ip,
    userAgent: log.userAgent,
    requestId: log.requestId,
  };
}

export class AuditLogController extends BaseController {
  constructor(private readonly auditLogService: AuditLogService) {
    super('AuditLogController');
  }

  listAuditLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sortBy, sortOrder, ...rest } = request.query as ListAuditLogQuery;
    const { page, all, pageSize, filters } = this.processPagination(rest);

    const { total, data } = await this.auditLogService.list({
      page,
      pageSize,
      sortBy,
      sortOrder,
      all,
      filters,
    });

    const resp: ListAuditLogResponse = data.map(mapToAuditLogResponse);

    if (all) {
      return this.successResponse(reply, resp);
    }

    return this.paginatedResponse(reply, resp, this.buildPaginationMeta(page, pageSize, total));
  };
}
