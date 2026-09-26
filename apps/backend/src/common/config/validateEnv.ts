import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['production', 'local', 'test']).default('local'),
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number').default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_SECRET: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().optional(),
  PASSWORD_SALT_ROUNDS: z.string().regex(/^\d+$/, 'PASSWORD_SALT_ROUNDS must be a number').default('12'),
  CORS_ORIGIN: z.string().default('*'),
  DEFAULT_PAGE_SIZE: z.string().regex(/^\d+$/, 'DEFAULT_PAGE_SIZE must be a number').default('20'),
  MAX_PAGE_SIZE: z.string().regex(/^\d+$/, 'MAX_PAGE_SIZE must be a number').default('100'),
  MAX_SORTING_LEVEL: z.string().regex(/^\d+$/, 'MAX_SORTING_LEVEL must be a number').default('999999'),
});

// appConfig falls back to fixed dev secrets, which must never sign production tokens
const envSchemaWithSecrets = envSchema.refine(
  (env) =>
    env.NODE_ENV !== 'production' || Boolean(env.JWT_SECRET || (env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET)),
  { path: ['JWT_SECRET'], message: 'JWT_SECRET (or JWT_ACCESS_SECRET + JWT_REFRESH_SECRET) is required in production' },
);

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchemaWithSecrets.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    process.stderr.write('\n❌ Invalid or missing environment variables:\n');
    for (const [field, messages] of Object.entries(errors)) {
      process.stderr.write(`   ${field}: ${(messages as string[]).join(', ')}\n`);
    }
    process.stderr.write('\n   Copy .env.example to .env and fill in the required values.\n\n');
    process.exit(1);
  }

  return result.data;
}
