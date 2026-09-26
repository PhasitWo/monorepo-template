import z from 'zod';
import { paginationQueryShape } from '../shared';

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  username: z
    .string()
    .trim()
    .min(4, 'Username must be at least 4 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, digits, dot, dash and underscore'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;

export const updateUserBodySchema = createUserBodySchema.pick({ name: true }).partial();
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;

export const listUsersQuerySchema = z.object({
  ...paginationQueryShape,
  sortBy: z.enum(['username', 'name', 'createdAt']).optional(),
  search: z.string().optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
