import { DatabaseClient } from '../../common/database/databaseClient';
import { UnitOfWork } from '../../common/database/unitOfWork';
import { AuditLogService } from '../../services/auditLog.service';

export const prisma = () => DatabaseClient.getInstance();

export const unitOfWork = new UnitOfWork();

/** Real audit log service (rows are written in the same tx) with an empty request context. */
export const auditLogService = new AuditLogService(() => ({}));

/** Add every new table here so each test starts from an empty database. */
export async function resetDb(): Promise<void> {
  await prisma().$executeRawUnsafe('TRUNCATE "AuditLog", "RunningNumber", "RefreshToken", "Tag", "User" CASCADE');
}

/** Starts all tasks at once and waits for every one to settle. */
export const concurrently = <T>(count: number, task: (i: number) => Promise<T>) =>
  Promise.allSettled(Array.from({ length: count }, (_, i) => task(i)));

export const fulfilled = <T>(results: PromiseSettledResult<T>[]) =>
  results.filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled').map((r) => r.value);

export const rejected = <T>(results: PromiseSettledResult<T>[]) =>
  results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason as unknown);

export const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const sortedIds = (rows: { runningId: number }[]) => rows.map((r) => r.runningId).sort((a, b) => a - b);
