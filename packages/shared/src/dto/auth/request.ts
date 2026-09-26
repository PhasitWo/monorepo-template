import z from 'zod';

export const loginBodySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password is required'),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;
