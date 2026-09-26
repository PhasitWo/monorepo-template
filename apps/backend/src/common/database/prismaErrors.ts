import { Prisma } from '../../.generated/client';

/** True for a unique-constraint violation (P2002), including ones raised through the pg driver adapter. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Runs a write and rethrows a unique-constraint violation as the given error, e.g. the entity's
 * duplicate-name ConflictError. Covers the race where a pre-check passes but the insert/update collides.
 */
export async function mapUniqueViolation<T>(write: () => Promise<T>, toError: () => Error): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isUniqueViolation(err)) throw toError();
    throw err;
  }
}
