import { allocateRunningNumber, RunningNumberScope } from '../runningNumberAllocator';
import { PrismaDBClient } from '../types';

describe('allocateRunningNumber', () => {
  const makeClient = (value: number) => {
    const $queryRaw = jest.fn().mockResolvedValue([{ value }]);
    return { client: { $queryRaw } as unknown as PrismaDBClient, $queryRaw };
  };

  it('returns the value from the atomic upsert', async () => {
    const { client, $queryRaw } = makeClient(7);

    await expect(allocateRunningNumber(client, RunningNumberScope.TAG, 'parent-1')).resolves.toBe(7);

    const [sql, scope, key] = $queryRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/INSERT INTO "RunningNumber".*ON CONFLICT \("scope", "key"\) DO UPDATE/s);
    expect(scope).toBe('TAG');
    expect(key).toBe('parent-1');
  });

  it("uses '' as the key for global scopes", async () => {
    const { client, $queryRaw } = makeClient(1);

    await allocateRunningNumber(client, RunningNumberScope.TAG);

    expect($queryRaw.mock.calls[0][2]).toBe('');
  });

  it('lower-cases the key so one scope never splits into two counters', async () => {
    const { client, $queryRaw } = makeClient(1);

    await allocateRunningNumber(client, RunningNumberScope.TAG, 'ABC-DEF');

    expect($queryRaw.mock.calls[0][2]).toBe('abc-def');
  });
});
