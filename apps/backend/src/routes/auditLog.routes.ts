import { FastifyInstance } from 'fastify';
import { listAuditLogQuerySchema, listAuditLogResponseSchema } from '@repo/shared';
import { baseSchema, commonErrorResponses, registerRoutes, successResponseSchema } from './routeBuilder';
import { useZodSchema } from '../common/utils/useZodSchema';
import { AuditLogService } from '../services/auditLog.service';
import { AuditLogController } from '../controllers/auditLog.controller';

export const registerAuditLogRoutes = (fastify: FastifyInstance): void => {
  const controller = new AuditLogController(new AuditLogService());

  registerRoutes(fastify, [
    {
      method: 'get',
      path: '/audit-logs',
      options: {
        schema: {
          ...baseSchema(
            'Audit Log',
            'List audit logs',
            'Retrieve audit log entries. Filterable by entityType, entityId, action, actorUserId, createdAt.',
          ),
          querystring: useZodSchema(listAuditLogQuerySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(listAuditLogResponseSchema, 'Audit logs retrieved successfully'),
          },
        },
      },
      handler: controller.listAuditLogs,
    },
  ]);
};
