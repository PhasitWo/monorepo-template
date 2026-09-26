import z from 'zod';

export const userDetailResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type UserDetailResponse = z.infer<typeof userDetailResponseSchema>;

export const listUsersResponseSchema = z.array(userDetailResponseSchema);
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
