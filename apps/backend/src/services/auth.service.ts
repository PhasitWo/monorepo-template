import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import ms from 'ms';
import { LoginBody, RefreshTokenBody, TokenResponse } from '@repo/shared';
import { AuditAction, AuditEntityType } from '../.generated/client';
import { appConfig } from '../common/config/appConfig';
import { UnitOfWork } from '../common/database/unitOfWork';
import { UnauthorizedError } from '../common/errors/errorTypes';
import { AuditLogService } from './auditLog.service';
import { BaseService } from './baseService';
import { SafeUser, UserService } from './user.service';

export enum LoginFailureReason {
  UNKNOWN_USER = 'UNKNOWN_USER',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
}

export class AuthService extends BaseService {
  constructor(
    private readonly userService: UserService,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogService: AuditLogService,
  ) {
    super();
  }

  async login(data: LoginBody): Promise<TokenResponse> {
    const hashedPassword = await this.userService.findPasswordByUsername(data.username);
    if (!hashedPassword) {
      await this.recordLoginFailure(data.username, LoginFailureReason.UNKNOWN_USER);
      throw new UnauthorizedError('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, hashedPassword);
    if (!isPasswordValid) {
      const target = await this.userService.findByUsername(data.username);
      await this.recordLoginFailure(data.username, LoginFailureReason.INVALID_PASSWORD, target?.id);
      throw new UnauthorizedError('Invalid username or password');
    }

    const user = await this.userService.findByUsername(data.username);
    if (!user) {
      await this.recordLoginFailure(data.username, LoginFailureReason.UNKNOWN_USER);
      throw new UnauthorizedError('Invalid username or password');
    }

    return this.unitOfWork.execute(async () => {
      const tokens = await this.issueTokens(user);
      await this.auditLogService.record({
        action: AuditAction.LOGIN_SUCCESS,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        actor: { userId: user.id, username: user.username },
      });
      return tokens;
    });
  }

  async refresh(data: RefreshTokenBody): Promise<TokenResponse> {
    let payload: { userId: string };
    try {
      payload = jwt.verify(data.refreshToken, appConfig.JWT_REFRESH_SECRET) as { userId: string };
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const existingToken = await this.prisma.refreshToken.findUnique({ where: { token: data.refreshToken } });
    if (!existingToken) {
      throw new UnauthorizedError('Refresh token not found');
    }

    if (new Date() > existingToken.expiresAt) {
      await this.prisma.refreshToken.deleteMany({ where: { token: data.refreshToken } });
      throw new UnauthorizedError('Refresh token expired');
    }

    // rotation + audit in one transaction; a missing user returns null (not throw) so the old token stays deleted
    const result = await this.unitOfWork.execute(async () => {
      // the delete is the claim: a concurrent refresh with the same token waits on the row lock, then deletes nothing
      const { count } = await this.prisma.refreshToken.deleteMany({ where: { token: data.refreshToken } });
      if (count === 0) {
        throw new UnauthorizedError('Refresh token not found');
      }

      const user = await this.userService.findById(payload.userId);
      if (!user) {
        return null;
      }

      const tokens = await this.issueTokens(user);
      await this.auditLogService.record({
        action: AuditAction.TOKEN_REFRESH,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        actor: { userId: user.id, username: user.username },
      });
      return tokens;
    });

    if (!result) {
      throw new UnauthorizedError('User not found');
    }
    return result;
  }

  /** Signs a new access/refresh token pair and stores the refresh token. Call inside a unit of work. */
  private async issueTokens(user: SafeUser): Promise<TokenResponse> {
    const accessToken = jwt.sign({ userId: user.id, username: user.username }, appConfig.JWT_ACCESS_SECRET, {
      expiresIn: appConfig.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    });
    // jwtid: without it, two tokens for one user signed in the same second are identical (and the column is unique)
    const refreshToken = jwt.sign({ userId: user.id }, appConfig.JWT_REFRESH_SECRET, {
      expiresIn: appConfig.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
      jwtid: randomUUID(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expiresAt = new Date(Date.now() + ms(appConfig.JWT_REFRESH_EXPIRES_IN as any));

    await this.prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, name: user.name },
    };
  }

  /** Written outside any transaction so it persists although the login throws. Never stores the password. */
  private recordLoginFailure(username: string, reason: LoginFailureReason, userId?: string): Promise<void> {
    return this.auditLogService.recordStandalone({
      action: AuditAction.LOGIN_FAILURE,
      entityType: userId ? AuditEntityType.USER : null,
      entityId: userId ?? null,
      metadata: { reason },
      actor: { userId: null, username },
    });
  }
}
