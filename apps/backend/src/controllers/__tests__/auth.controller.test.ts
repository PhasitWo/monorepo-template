import { makeReply, makeRequest, sent } from '../../__tests__/utils/http';
import { createMock } from '../../__tests__/utils/mockFactory';
import { AuthController } from '../auth.controller';
import { AuthService } from '../../services/auth.service';

describe('AuthController', () => {
  const tokens = { accessToken: 'a', refreshToken: 'r', user: { id: 'u1', username: 'alice01', name: 'Alice' } };

  it('returns tokens from login and refresh', async () => {
    const service = createMock<AuthService>({
      login: jest.fn().mockResolvedValue(tokens),
      refresh: jest.fn().mockResolvedValue(tokens),
    });
    const controller = new AuthController(service);
    const [loginReply, refreshReply] = [makeReply(), makeReply()];

    await controller.login(makeRequest({ body: { username: 'alice01', password: 'secret123' } }), loginReply);
    await controller.refresh(makeRequest({ body: { refreshToken: 'r' } }), refreshReply);

    expect(service.login).toHaveBeenCalledWith({ username: 'alice01', password: 'secret123' });
    expect(service.refresh).toHaveBeenCalledWith({ refreshToken: 'r' });
    expect(sent(loginReply).data).toEqual(tokens);
    expect(sent(refreshReply).data).toEqual(tokens);
  });
});
