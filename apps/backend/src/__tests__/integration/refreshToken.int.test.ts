import { DatabaseClient } from '../../common/database/databaseClient';
import { UnauthorizedError } from '../../common/errors/errorTypes';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { auditLogService, concurrently, fulfilled, prisma, rejected, resetDb, unitOfWork } from './helpers';

const userService = new UserService(unitOfWork, auditLogService);
const authService = new AuthService(userService, unitOfWork, auditLogService);

// Concurrent refreshes with one token all pass the lookup before any commits, so only the delete inside
// the transaction can decide the winner — a replayed token must never yield a second session.
describe('refresh token rotation', () => {
  beforeEach(resetDb);
  afterAll(() => DatabaseClient.disconnect());

  it('a token used concurrently is rotated exactly once', async () => {
    await userService.create({ username: 'alice01', name: 'Alice', password: 'password123' });
    const { refreshToken } = await authService.login({ username: 'alice01', password: 'password123' });

    const results = await concurrently(5, () => authService.refresh({ refreshToken }));

    expect(fulfilled(results)).toHaveLength(1);
    rejected(results).forEach((e) => expect(e).toBeInstanceOf(UnauthorizedError));
    const rows = await prisma().refreshToken.findMany();
    expect(rows.map((r) => r.token)).toEqual([fulfilled(results)[0].refreshToken]);
  });

  it('a rotated token cannot be reused', async () => {
    await userService.create({ username: 'bob01', name: 'Bob', password: 'password123' });
    const { refreshToken } = await authService.login({ username: 'bob01', password: 'password123' });

    await authService.refresh({ refreshToken });

    await expect(authService.refresh({ refreshToken })).rejects.toThrow(UnauthorizedError);
  });
});
