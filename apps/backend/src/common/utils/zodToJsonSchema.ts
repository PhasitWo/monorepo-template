import z from 'zod';

export function toJSONSchema(zodSchema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(zodSchema, {
    unrepresentable: 'any',
    override: (ctx) => {
      const def = ctx.zodSchema._zod.def;
      if (def.type === 'date') {
        ctx.jsonSchema.type = 'string';
        ctx.jsonSchema.format = 'date-time';
      }
    },
  });
}
