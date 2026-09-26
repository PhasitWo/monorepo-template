import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuditAction, AuditEntityType, RefreshToken } from '../../.generated/client';
import { appConfig } from '../../common/config/appConfig';
import { UnauthorizedError } from '../../common/errors/errorTypes';
import {
  createMock,
  createMockUnitOfWork,
  expectCalledInTx,
  expectCalledOutsideTx,
} from '../../__tests__/utils/mockFactory';
import { mockDatabaseClient } from '../../__tests__/utils/prismaMock';
import { AuditLogService } from '../auditLog.service';
import { AuthService, LoginFailureReason } from '../auth.service';
import { SafeUser, UserService } from '../user.service';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));
const compare = bcrypt.compare as jest.Mock;

const PASSWORD = 'plain-password-123';
const user: SafeUser = {
  id: 'u1',
  username: 'alice01',
  name: 'Alice',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  deletedAt: null,
};

describe('AuthService', () => {
  let db: ReturnType<typeof mockDatabaseClient>;
  let userService: jest.Mocked<UserService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let service: AuthService;

  beforeEach(() => {
    db = mockDatabaseClient();
    userService = createMock<UserService>();
    auditLogService = createMock<AuditLogService>();
    service = new AuthService(userService, createMockUnitOfWork(), auditLogService);
    compare.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  const serializedAuditCalls = () =>
    JSON.stringify([auditLogService.record.mock.calls, auditLogService.recordStandalone.mock.calls]);

  describe('login', () => {
    it('stores the refresh token and records LOGIN_SUCCESS in the transaction', async () => {
      userService.findPasswordByUsername.mockResolvedValue('hash');
      compare.mockResolvedValue(true);
      userService.findByUsername.mockResolvedValue(user);

      const result = await service.login({ username: 'alice01', password: PASSWORD });

      expect(result.user).toEqual({ id: 'u1', username: 'alice01', name: 'Alice' });
      expectCalledInTx(db.refreshToken.create);
      expect(db.refreshToken.create).toHaveBeenCalledWith({
        data: { token: result.refreshToken, userId: 'u1', expiresAt: expect.any(Date) },
      });
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.LOGIN_SUCCESS,
        entityType: AuditEntityType.USER,
        entityId: 'u1',
        actor: { userId: 'u1', username: 'alice01' },
      });
      expectCalledInTx(auditLogService.record);
      const serialized = serializedAuditCalls();
      expect(serialized).not.toContain(PASSWORD);
      expect(serialized).not.toContain(result.refreshToken);
      expect(serialized).not.toContain(result.accessToken);
    });

    it('issues a different refresh token each time, even within the same second', async () => {
      userService.findPasswordByUsername.mockResolvedValue('hash');
      compare.mockResolvedValue(true);
      userService.findByUsername.mockResolvedValue(user);

      const first = await service.login({ username: 'alice01', password: PASSWORD });
      const second = await service.login({ username: 'alice01', password: PASSWORD });

      expect(second.refreshToken).not.toBe(first.refreshToken);
    });

    it('unknown username records LOGIN_FAILURE (UNKNOWN_USER) and throws', async () => {
      userService.findPasswordByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'ghost', password: PASSWORD })).rejects.toThrow(
        new UnauthorizedError('Invalid username or password'),
      );
      expectCalledOutsideTx(auditLogService.recordStandalone);
      expect(auditLogService.recordStandalone).toHaveBeenCalledWith({
        action: AuditAction.LOGIN_FAILURE,
        entityType: null,
        entityId: null,
        metadata: { reason: LoginFailureReason.UNKNOWN_USER },
        actor: { userId: null, username: 'ghost' },
      });
      expect(auditLogService.record).not.toHaveBeenCalled();
      expect(serializedAuditCalls()).not.toContain(PASSWORD);
    });

    it('wrong password records LOGIN_FAILURE (INVALID_PASSWORD) against the user', async () => {
      userService.findPasswordByUsername.mockResolvedValue('hash');
      compare.mockResolvedValue(false);
      userService.findByUsername.mockResolvedValue(user);

      await expect(service.login({ username: 'alice01', password: PASSWORD })).rejects.toThrow(UnauthorizedError);
      expectCalledOutsideTx(auditLogService.recordStandalone);
      expect(auditLogService.recordStandalone).toHaveBeenCalledWith({
        action: AuditAction.LOGIN_FAILURE,
        entityType: AuditEntityType.USER,
        entityId: 'u1',
        metadata: { reason: LoginFailureReason.INVALID_PASSWORD },
        actor: { userId: null, username: 'alice01' },
      });
      expect(serializedAuditCalls()).not.toContain(PASSWORD);
    });

    it('user vanishing after the password check records UNKNOWN_USER', async () => {
      userService.findPasswordByUsername.mockResolvedValue('hash');
      compare.mockResolvedValue(true);
      userService.findByUsername.mockResolvedValue(null);

      await expect(service.login({ username: 'alice01', password: PASSWORD })).rejects.toThrow(UnauthorizedError);
      expect(auditLogService.recordStandalone).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { reason: LoginFailureReason.UNKNOWN_USER } }),
      );
    });
  });

  describe('refresh', () => {
    let token: string;

    beforeEach(() => {
      token = jwt.sign({ userId: 'u1' }, appConfig.JWT_REFRESH_SECRET, { expiresIn: '1h' });
    });

    const stored = (expiresAt: Date): RefreshToken => ({
      id: 'rt1',
      token,
      userId: 'u1',
      expiresAt,
      createdAt: new Date(),
    });

    it('rotates the token and records TOKEN_REFRESH', async () => {
      db.refreshToken.findUnique.mockResolvedValue(stored(new Date(Date.now() + 60_000)));
      userService.findById.mockResolvedValue(user);

      const result = await service.refresh({ refreshToken: token });

      expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token } });
      expectCalledInTx(db.refreshToken.deleteMany);
      expectCalledInTx(userService.findById);
      expectCalledInTx(db.refreshToken.create);
      expect(result.user.id).toBe('u1');
      expect(auditLogService.record).toHaveBeenCalledWith({
        action: AuditAction.TOKEN_REFRESH,
        entityType: AuditEntityType.USER,
        entityId: 'u1',
        actor: { userId: 'u1', username: 'alice01' },
      });
      expectCalledInTx(auditLogService.record);
      expect(serializedAuditCalls()).not.toContain(token);
    });

    it('invalid token throws and writes no audit row', async () => {
      await expect(service.refresh({ refreshToken: 'garbage' })).rejects.toThrow(UnauthorizedError);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('unknown token throws and writes no audit row', async () => {
      db.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: token })).rejects.toThrow('Refresh token not found');
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('expired stored token is deleted, throws, and writes no audit row', async () => {
      db.refreshToken.findUnique.mockResolvedValue(stored(new Date(Date.now() - 1000)));

      await expect(service.refresh({ refreshToken: token })).rejects.toThrow('Refresh token expired');
      expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token } });
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('missing user throws after the old token is deleted, with no audit row', async () => {
      db.refreshToken.findUnique.mockResolvedValue(stored(new Date(Date.now() + 60_000)));
      userService.findById.mockResolvedValue(null);

      await expect(service.refresh({ refreshToken: token })).rejects.toThrow('User not found');
      expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token } });
      expect(db.refreshToken.create).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });
});
