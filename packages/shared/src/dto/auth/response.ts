import z from 'zod';

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
  }),
});
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
