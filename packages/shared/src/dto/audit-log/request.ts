import z from 'zod';
import { paginationQueryShape } from '../shared';

// mirror the Prisma AuditAction / AuditEntityType enums
export const auditActionEnum = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'TOKEN_REFRESH',
]);
export type AuditActionEnum = z.infer<typeof auditActionEnum>;

export const auditEntityTypeEnum = z.enum(['USER', 'TAG']);
export type AuditEntityTypeEnum = z.infer<typeof auditEntityTypeEnum>;

export const listAuditLogQuerySchema = z.object({
  ...paginationQueryShape,
  sortBy: z.enum(['createdAt']).optional(),
  filters: z.string().optional(),
});
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
