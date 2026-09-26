import bcrypt from 'bcrypt';
import { CreateUserBody, ERROR_CODE, UpdateUserBody } from '@repo/shared';
import { AuditAction, AuditEntityType, Prisma, User } from '../.generated/client';
import { appConfig } from '../common/config/appConfig';
import { mapUniqueViolation } from '../common/database/prismaErrors';
import { UnitOfWork } from '../common/database/unitOfWork';
import { ConflictError, NotFoundError } from '../common/errors/errorTypes';
import { AuditLogService } from './auditLog.service';
import { BaseService, ListParams, ListResult } from './baseService';

/** A user without the password hash — the only shape this service returns. */
export type SafeUser = Omit<User, 'password'>;

export interface ListUserParams extends ListParams {
  search?: string;
}

// pass to every user query that returns a row, so the hash never leaves this service
const omitPassword = { password: true } as const;

const duplicateUsernameError = () =>
  new ConflictError('Duplicate username', undefined, { code: ERROR_CODE.DUPLICATE_USERNAME });

export class UserService extends BaseService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogService: AuditLogService,
  ) {
    super();
  }

  /** Non-deleted user, or null. */
  findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id, deletedAt: null }, omit: omitPassword });
  }

  /** Non-deleted user, or null. */
  findByUsername(username: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { username, deletedAt: null }, omit: omitPassword });
  }

  /** The only way to read the password hash. */
  async findPasswordByUsername(username: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { username, deletedAt: null },
      select: { password: true },
    });
    return user?.password ?? null;
  }

  async getById(id: string): Promise<SafeUser> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async list(params: ListUserParams): Promise<ListResult<SafeUser>> {
    const { sortBy = 'createdAt', sortOrder = 'asc', search } = params;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        omit: omitPassword,
        orderBy: { [sortBy]: sortOrder },
        ...this.pageArgs(params),
      }),
    ]);
    return { total, data };
  }

  async create(input: CreateUserBody): Promise<SafeUser> {
    const username = input.username.trim();
    if (await this.findByUsername(username)) {
      throw duplicateUsernameError();
    }

    // hash outside the transaction: bcrypt is deliberately slow
    const password = await bcrypt.hash(input.password, appConfig.SALT_ROUNDS);

    return this.unitOfWork.execute(async () => {
      // usernames stay unique across soft-deleted rows too, so the insert can still collide
      const created = await mapUniqueViolation(
        () =>
          this.prisma.user.create({
            data: { username, name: input.name.trim(), password },
            omit: omitPassword,
          }),
        duplicateUsernameError,
      );
      await this.auditLogService.record({
        action: AuditAction.CREATE,
        entityType: AuditEntityType.USER,
        entityId: created.id,
      });
      return created;
    });
  }

  async update(id: string, input: UpdateUserBody): Promise<SafeUser> {
    return this.unitOfWork.execute(async () => {
      const existing = await this.getById(id);
      const updated = await this.prisma.user.update({
        where: { id, deletedAt: null },
        data: { name: input.name?.trim() },
        omit: omitPassword,
      });
      await this.auditLogService.record({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.USER,
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  /** Soft delete: sets deletedAt and keeps the row for history. */
  async delete(id: string): Promise<void> {
    await this.unitOfWork.execute(async () => {
      await this.getById(id);
      await this.prisma.user.update({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
      // end every session: a deleted user must not be able to refresh an access token
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
      await this.auditLogService.record({
        action: AuditAction.DELETE,
        entityType: AuditEntityType.USER,
        entityId: id,
      });
    });
  }
}
