import { UnitOfWork } from '../../common/database/unitOfWork';

/**
 * Mocks any class (e.g. a service) with every method auto-stubbed as `jest.fn()` on first access, so tests only
 * set up the methods they use and don't break when the class gains a method.
 */
export function createMock<T extends object>(overrides: Partial<{ [K in keyof T]: T[K] }> = {}): jest.Mocked<T> {
  return new Proxy(overrides as jest.Mocked<T>, {
    get(target, prop: string | symbol): unknown {
      if (prop in target) {
        return target[prop as keyof T];
      }
      const mock = jest.fn();
      (target as Record<string | symbol, unknown>)[prop] = mock;
      return mock;
    },
  });
}

/**
 * [entry, exit] Jest invocation-call-order positions of every mock execute() call in this test file.
 * Call order is global and monotonic, so windows from earlier tests never contain later calls.
 */
const txWindows: Array<[number, number]> = [];

/**
 * Unit of work that runs the callback immediately, propagating its result or rejection, and records
 * the window each execute() call spans so tests can assert a mock was called inside the transaction.
 */
export function createMockUnitOfWork(): jest.Mocked<UnitOfWork> {
  const exitMarker = jest.fn();
  const execute = jest.fn(async (fn: () => Promise<unknown>) => {
    // jest records this call's order before running the implementation
    const entry = execute.mock.invocationCallOrder[execute.mock.invocationCallOrder.length - 1];
    try {
      return await fn();
    } finally {
      exitMarker();
      txWindows.push([entry, exitMarker.mock.invocationCallOrder[exitMarker.mock.invocationCallOrder.length - 1]]);
    }
  });
  return { execute } as unknown as jest.Mocked<UnitOfWork>;
}

type AnyMock = { mock: { invocationCallOrder: number[] } };

function isInTx(fn: AnyMock, callIndex: number): boolean {
  const order = fn.mock.invocationCallOrder[callIndex];
  if (order === undefined) {
    throw new Error(`mock was not called ${callIndex + 1} time(s)`);
  }
  return txWindows.some(([entry, exit]) => order > entry && order < exit);
}

/** Asserts the mock's nth call happened inside a mock unitOfWork.execute() callback. */
export function expectCalledInTx(fn: AnyMock, callIndex = 0): void {
  if (!isInTx(fn, callIndex)) {
    throw new Error(`expected call #${callIndex} to happen inside unitOfWork.execute(), but it was outside`);
  }
}

/** Asserts the mock's nth call happened outside every mock unitOfWork.execute() callback. */
export function expectCalledOutsideTx(fn: AnyMock, callIndex = 0): void {
  if (isInTx(fn, callIndex)) {
    throw new Error(`expected call #${callIndex} to happen outside unitOfWork.execute(), but it was inside`);
  }
}
