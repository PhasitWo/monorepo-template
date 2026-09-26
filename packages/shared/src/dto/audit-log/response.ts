import z from 'zod';
import { auditActionEnum, auditEntityTypeEnum } from './request';

export const auditLogResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  action: auditActionEnum,
  entityType: auditEntityTypeEnum.nullable(),
  entityId: z.string().nullable(),
  // { field: [old, new] } — an array, not z.tuple: the response serializer can't handle tuple (prefixItems) schemas
  diff: z.record(z.string(), z.array(z.unknown())).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  actorUserId: z.string().nullable(),
  actorUsername: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
});
export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

export const listAuditLogResponseSchema = z.array(auditLogResponseSchema);
export type ListAuditLogResponse = z.infer<typeof listAuditLogResponseSchema>;
