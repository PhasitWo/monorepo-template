import { requestContext } from '@fastify/request-context';
import { getAuditContext } from '../auditContext';

jest.mock('@fastify/request-context', () => ({ requestContext: { get: jest.fn() } }));

describe('getAuditContext', () => {
  const get = requestContext.get as jest.Mock;

  it('returns the audit context of the current request', () => {
    get.mockReturnValue({ actorUserId: 'u1', requestId: 'r1' });

    expect(getAuditContext()).toEqual({ actorUserId: 'u1', requestId: 'r1' });
    expect(get).toHaveBeenCalledWith('audit');
  });

  it('returns an empty object outside a request', () => {
    get.mockReturnValue(undefined);

    expect(getAuditContext()).toEqual({});
  });
});
