import type { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '../../../.generated/client';
import { ErrorHandler } from '../errorHandler';
import { ConflictError, NotFoundError } from '../errorTypes';

describe('ErrorHandler', () => {
  const request = { method: 'POST', url: '/tags', headers: {}, ip: '127.0.0.1' } as unknown as FastifyRequest;
  let reply: { status: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    reply = { status: jest.fn(), send: jest.fn() };
    reply.status.mockReturnValue(reply);
    reply.send.mockReturnValue(reply);
  });

  const handle = (error: unknown) => new ErrorHandler().handle(error, request, reply as unknown as FastifyReply);

  it('maps an unmapped Prisma unique violation (P2002) to a generic 409', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`name`)', {
      code: 'P2002',
      clientVersion: 'test',
    });

    await handle(err);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'common.conflict' }),
      }),
    );
  });

  it('keeps an already-mapped ConflictError and its ERROR_CODE', async () => {
    await handle(new ConflictError('Duplicate tag name', undefined, { code: 'DUPLICATE_TAG_NAME' }));

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'DUPLICATE_TAG_NAME' }) }),
    );
  });

  it('leaves other errors unchanged', async () => {
    await handle(new NotFoundError('Tag not found'));
    expect(reply.status).toHaveBeenLastCalledWith(404);

    await handle(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );
    expect(reply.status).toHaveBeenLastCalledWith(500);
  });
});
