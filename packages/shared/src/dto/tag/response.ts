import z from 'zod';

export const tagDetailResponseSchema = z.object({
  id: z.string(),
  runningId: z.number(),
  runningCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type TagDetailResponse = z.infer<typeof tagDetailResponseSchema>;

export const listTagResponseSchema = z.array(tagDetailResponseSchema);
export type ListTagResponse = z.infer<typeof listTagResponseSchema>;
