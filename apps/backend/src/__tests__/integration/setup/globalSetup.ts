import { execSync } from 'node:child_process';
import path from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

/** Starts a throwaway Postgres, points DATABASE_URL at it and applies every migration. */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  globalThis.__PG_CONTAINER__ = container;

  // test workers inherit this env, and DatabaseClient reads it when first imported
  process.env.DATABASE_URL = container.getConnectionUri();

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../../../..'),
    env: process.env,
    stdio: 'pipe',
  });
}
