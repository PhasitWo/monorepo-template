import { Prisma } from '../../../.generated/client';
import { isUniqueViolation, mapUniqueViolation } from '../prismaErrors';
import { ConflictError } from '../../errors/errorTypes';

const knownError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test', meta });

describe('prismaErrors', () => {
  describe('isUniqueViolation', () => {
    it('is true for P2002', () => {
      expect(isUniqueViolation(knownError('P2002', { target: ['name'] }))).toBe(true);
    });

    it('is true for P2002 raised through the pg driver adapter', () => {
      const err = knownError('P2002', {
        modelName: 'Tag',
        driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint: { fields: ['name'] } } },
      });
      expect(isUniqueViolation(err)).toBe(true);
    });

    it('is false for other Prisma codes, plain errors and non-errors', () => {
      expect(isUniqueViolation(knownError('P2025'))).toBe(false);
      expect(isUniqueViolation(new Error('P2002'))).toBe(false);
      expect(isUniqueViolation({ code: 'P2002' })).toBe(false);
      expect(isUniqueViolation(undefined)).toBe(false);
    });
  });

  describe('mapUniqueViolation', () => {
    const toError = () => new ConflictError('Duplicate', undefined, { code: 'DUPLICATE_X' });

    it('returns the write result', async () => {
      await expect(mapUniqueViolation(async () => 'ok', toError)).resolves.toBe('ok');
    });

    it('rethrows a unique violation as the given error', async () => {
      const result = mapUniqueViolation(async () => {
        throw knownError('P2002');
      }, toError);
      await expect(result).rejects.toBeInstanceOf(ConflictError);
      await expect(result).rejects.toMatchObject({ errorCode: 'DUPLICATE_X', statusCode: 409 });
    });

    it('rethrows other errors unchanged', async () => {
      const other = knownError('P2025');
      await expect(
        mapUniqueViolation(async () => {
          throw other;
        }, toError),
      ).rejects.toBe(other);
    });
  });
});
