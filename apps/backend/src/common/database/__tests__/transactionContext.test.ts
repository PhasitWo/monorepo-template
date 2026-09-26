import { InternalServerError } from '../../errors/errorTypes';
import { BaseService } from '../../../services/baseService';
import { DatabaseClient } from '../databaseClient';
import { TransactionContext } from '../transactionContext';
import { PrismaDBClient, PrismaTxClient } from '../types';
import { UnitOfWork } from '../unitOfWork';

class ProbeService extends BaseService {
  client(): PrismaDBClient {
    return this.prisma;
  }
  root(): PrismaDBClient {
    return this.rootPrisma;
  }
}

const fakeTx = (name: string) => ({ name }) as unknown as PrismaTxClient;
const nextTick = () => new Promise((resolve) => setImmediate(resolve));

describe('TransactionContext', () => {
  it('has no client outside a scope', () => {
    expect(TransactionContext.current()).toBeUndefined();
  });

  it('exposes the client inside a scope and returns fn result', async () => {
    const tx = fakeTx('tx');

    const result = await TransactionContext.run(tx, async () => {
      await nextTick();
      expect(TransactionContext.current()).toBe(tx);
      return 42;
    });

    expect(result).toBe(42);
    expect(TransactionContext.current()).toBeUndefined();
  });

  it('keeps concurrent scopes isolated', async () => {
    const txA = fakeTx('a');
    const txB = fakeTx('b');

    const seen = await Promise.all(
      [txA, txB].map((tx) =>
        TransactionContext.run(tx, async () => {
          await nextTick();
          return TransactionContext.current();
        }),
      ),
    );

    expect(seen[0]).toBe(txA);
    expect(seen[1]).toBe(txB);
  });

  it('throws when work outlives its scope instead of using a closed transaction', async () => {
    let leaked: Promise<unknown> | undefined;

    await TransactionContext.run(fakeTx('tx'), async () => {
      // un-awaited: runs after the scope has closed
      leaked = nextTick().then(() => TransactionContext.current());
    });

    await expect(leaked).rejects.toThrow(InternalServerError);
    await expect(leaked).rejects.toThrow('Database used after its unit of work closed');
  });

  it('closes the scope when fn rejects', async () => {
    let leaked: Promise<unknown> | undefined;

    await expect(
      TransactionContext.run(fakeTx('tx'), async () => {
        leaked = nextTick().then(() => TransactionContext.current());
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(leaked).rejects.toThrow(InternalServerError);
  });
});

describe('UnitOfWork', () => {
  const root = { $transaction: jest.fn() };
  const tx = fakeTx('tx');
  const uow = new UnitOfWork();

  beforeEach(() => {
    root.$transaction.mockReset();
    root.$transaction.mockImplementation((cb: (client: PrismaTxClient) => Promise<unknown>) => cb(tx));
    jest
      .spyOn(DatabaseClient, 'getInstance')
      .mockReturnValue(root as unknown as ReturnType<typeof DatabaseClient.getInstance>);
  });

  afterEach(() => jest.restoreAllMocks());

  it('starts one transaction and makes it ambient', async () => {
    const result = await uow.execute(async () => TransactionContext.current());

    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe(tx);
  });

  it('joins the outer transaction when nested', async () => {
    const inner = await uow.execute(() => new UnitOfWork().execute(async () => TransactionContext.current()));

    expect(root.$transaction).toHaveBeenCalledTimes(1);
    expect(inner).toBe(tx);
  });

  it('propagates an error thrown in a nested execute out of the outer one', async () => {
    await expect(
      uow.execute(() =>
        uow.execute(async () => {
          throw new Error('inner failed');
        }),
      ),
    ).rejects.toThrow('inner failed');
    expect(root.$transaction).toHaveBeenCalledTimes(1);
  });

  it('services use the transaction client inside execute and the root client outside', async () => {
    const service = new ProbeService();

    const inside = await uow.execute(async () => ({ client: service.client(), root: service.root() }));

    expect(inside.client).toBe(tx);
    expect(inside.root).toBe(root);
    expect(service.client()).toBe(root);
  });
});

describe('DatabaseClient', () => {
  it('returns the same instance on every call', () => {
    expect(DatabaseClient.getInstance()).toBe(DatabaseClient.getInstance());
  });
});
