import { createMockUnitOfWork, expectCalledInTx, expectCalledOutsideTx } from './mockFactory';

describe('mock unit of work', () => {
  it('tells calls inside execute() from calls outside it', async () => {
    const uow = createMockUnitOfWork();
    const write = jest.fn();

    write('before');
    await uow.execute(async () => write('inside'));
    write('after');

    expectCalledOutsideTx(write, 0);
    expectCalledInTx(write, 1);
    expectCalledOutsideTx(write, 2);
    expect(() => expectCalledInTx(write, 0)).toThrow('inside unitOfWork.execute()');
    expect(() => expectCalledOutsideTx(write, 1)).toThrow('outside unitOfWork.execute()');
  });

  it('still records the window when the callback rejects', async () => {
    const uow = createMockUnitOfWork();
    const write = jest.fn();

    await expect(
      uow.execute(async () => {
        write();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expectCalledInTx(write);
  });

  it('fails clearly when the mock was never called', () => {
    expect(() => expectCalledInTx(jest.fn())).toThrow('mock was not called 1 time(s)');
  });
});
