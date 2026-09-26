import z from 'zod';

export function useZodSchema(
  $zodSchema: z.ZodType,
  options?: {
    description?: string;
  },
): Record<string, unknown> {
  return {
    $zodSchema,
    description: options?.description,
  };
}
