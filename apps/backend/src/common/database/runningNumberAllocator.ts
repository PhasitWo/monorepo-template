import { RunningNumberScope } from '../../.generated/client';
import { PrismaDBClient } from './types';

export { RunningNumberScope };

/**
 * Allocates the next running number for (scope, key) with one atomic upsert.
 *
 * Pass the service's ambient client (`this.prisma`) and call it inside the unit of work that
 * inserts the record: the counter row stays locked until that transaction ends, so concurrent
 * creates in the same scope queue up, and a rollback hands the number back (no gaps).
 */
export async function allocateRunningNumber(
  client: PrismaDBClient,
  scope: RunningNumberScope,
  key = '',
): Promise<number> {
  // keys are uuids or '' — normalise case so one scope never splits into two counters
  const normalizedKey = key.toLowerCase();
  const rows = await client.$queryRaw<{ value: number }[]>`
    INSERT INTO "RunningNumber" ("scope", "key", "value")
    VALUES (${scope}::"RunningNumberScope", ${normalizedKey}, 1)
    ON CONFLICT ("scope", "key") DO UPDATE SET "value" = "RunningNumber"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}
