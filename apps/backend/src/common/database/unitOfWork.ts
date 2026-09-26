import { DatabaseClient } from './databaseClient';
import { TransactionContext } from './transactionContext';

export class UnitOfWork {
  /**
   * Runs fn in a database transaction. `this.prisma` queries made anywhere inside fn (including in
   * other services) join it, and a nested execute joins the outer transaction.
   * Do not start un-awaited database work inside fn.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (TransactionContext.current()) {
      // Already inside a transaction — join it, don't start a new one
      return fn();
    }
    return DatabaseClient.getInstance().$transaction((tx) => TransactionContext.run(tx, fn));
  }
}
