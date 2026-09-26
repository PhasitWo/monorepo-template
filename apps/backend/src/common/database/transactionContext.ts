import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaTxClient } from './types';
import { InternalServerError } from '../errors/errorTypes';

interface TxScope {
  client: PrismaTxClient;
  closed: boolean;
}

const storage = new AsyncLocalStorage<TxScope>();

/** Holds the ambient Prisma transaction client for the current async call chain. */
export const TransactionContext = {
  /**
   * Active transaction client, or undefined outside a unit-of-work scope.
   * Throws if the scope's transaction has already closed, e.g. un-awaited work started inside it.
   */
  current(): PrismaTxClient | undefined {
    const scope = storage.getStore();
    if (!scope) return undefined;
    if (scope.closed) {
      throw new InternalServerError(
        'Database used after its unit of work closed — un-awaited work inside unitOfWork.execute()?',
      );
    }
    return scope.client;
  },

  /** Runs fn with tx as the ambient client; the scope is marked closed once fn settles. */
  async run<T>(tx: PrismaTxClient, fn: () => Promise<T>): Promise<T> {
    const scope: TxScope = { client: tx, closed: false };
    try {
      return await storage.run(scope, fn);
    } finally {
      scope.closed = true;
    }
  },
};
