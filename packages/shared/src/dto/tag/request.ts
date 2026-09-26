import z from 'zod';
import { paginationQueryShape } from '../shared';

export const listTagQuerySchema = z.object({
  ...paginationQueryShape,
  sortBy: z.enum(['runningId', 'name', 'createdAt', 'updatedAt']).optional(),
  search: z.string().optional(),
  filters: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});
export type ListTagQuery = z.infer<typeof listTagQuerySchema>;

export const createTagBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(500).nullable().optional(),
});
export type CreateTagBody = z.infer<typeof createTagBodySchema>;

export const updateTagBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTagBody = z.infer<typeof updateTagBodySchema>;
