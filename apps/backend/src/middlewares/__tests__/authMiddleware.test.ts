import jwt from 'jsonwebtoken';
import { makeReply, makeRequest } from '../../__tests__/utils/http';
import { appConfig } from '../../common/config/appConfig';
import { AuthMiddleware } from '../authMiddleware';

describe('AuthMiddleware', () => {
  const middleware = new AuthMiddleware();
  const validToken = () => jwt.sign({ userId: 'u1', username: 'alice01' }, appConfig.JWT_ACCESS_SECRET);

  it('sets request.user and the audit actor from a valid token', async () => {
    const request = makeRequest({ headers: { authorization: `Bearer ${validToken()}` } });

    await middleware.authenticate(request, makeReply());

    expect(request.isAuthenticated).toBe(true);
    expect(request.user).toEqual({ userId: 'u1', username: 'alice01' });
    expect(request.store.audit).toEqual({ requestId: 'r1', ip: '::1', actorUserId: 'u1', actorUsername: 'alice01' });
  });

  it('rejects a missing header with 401', async () => {
    const reply = makeReply();

    await middleware.authenticate(makeRequest(), reply);

    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it('responds 500 when the request context is unavailable', async () => {
    const request = makeRequest({ headers: { authorization: `Bearer ${validToken()}` } });
    (request.requestContext.set as jest.Mock).mockImplementation(() => {
      throw new Error('no context');
    });
    const reply = makeReply();

    await middleware.authenticate(request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
  });

  it('rejects an invalid token with 401 and sets no actor', async () => {
    const request = makeRequest({ headers: { authorization: 'Bearer nope' } });
    const reply = makeReply();

    await middleware.authenticate(request, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(request.user).toBeUndefined();
    expect(request.requestContext.set).not.toHaveBeenCalled();
  });
});
