import { CreateTagBody, ERROR_CODE, UpdateTagBody } from '@repo/shared';
import { AuditAction, AuditEntityType, Prisma, Tag } from '../.generated/client';
import { mapUniqueViolation } from '../common/database/prismaErrors';
import { allocateRunningNumber, RunningNumberScope } from '../common/database/runningNumberAllocator';
import { UnitOfWork } from '../common/database/unitOfWork';
import { ConflictError, NotFoundError } from '../common/errors/errorTypes';
import { AuditLogService } from './auditLog.service';
import { BaseService, ListParams, ListResult } from './baseService';

export interface ListTagParams extends ListParams {
  search?: string;
  isActive?: boolean;
}

const duplicateTagNameError = () =>
  new ConflictError('Duplicate tag name', undefined, { code: ERROR_CODE.DUPLICATE_TAG_NAME });

/** '' and whitespace-only become null. */
const normalizeDescription = (description: string | null | undefined) => description?.trim() || null;

export class TagService extends BaseService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly auditLogService: AuditLogService,
  ) {
    super();
  }

  async getById(id: string): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundError('Tag not found');
    }
    return tag;
  }

  async list(params: ListTagParams): Promise<ListResult<Tag>> {
    const { sortBy = 'createdAt', sortOrder = 'asc', search, filters, isActive } = params;
    const searchWhere: Prisma.TagWhereInput | undefined = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : undefined;
    // allow-list: only these fields can be filtered, each with its operator set
    const filterWhere = this.transformToWhereClause<Tag>(filters, {
      runningId: this.transformToNumberWhereClause,
      name: this.transformToStringWhereClause,
      isActive: this.transformToDropdownWhereClause,
      createdAt: this.transformToDateWhereClause,
      updatedAt: this.transformToDateWhereClause,
    });
    const where = { ...searchWhere, ...filterWhere, isActive };
    const [total, data] = await Promise.all([
      this.prisma.tag.count({ where }),
      this.prisma.tag.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...this.pageArgs(params) }),
    ]);
    return { total, data };
  }

  async create(input: CreateTagBody): Promise<Tag> {
    const name = input.name.trim();
    // friendly pre-check; mapUniqueViolation turns the race where two creates both pass it into the same error
    if (await this.prisma.tag.findUnique({ where: { name } })) {
      throw duplicateTagNameError();
    }

    return this.unitOfWork.execute(async () => {
      // allocated in the same transaction as the insert, so a rollback hands the number back
      const runningId = await allocateRunningNumber(this.prisma, RunningNumberScope.TAG);
      const created = await mapUniqueViolation(
        () =>
          this.prisma.tag.create({
            data: {
              runningId,
              runningCode: `T${runningId.toString().padStart(6, '0')}`,
              name,
              description: normalizeDescription(input.description),
              isActive: true,
            },
          }),
        duplicateTagNameError,
      );
      await this.auditLogService.record({
        action: AuditAction.CREATE,
        entityType: AuditEntityType.TAG,
        entityId: created.id,
      });
      return created;
    });
  }

  async update(id: string, input: UpdateTagBody): Promise<Tag> {
    return this.unitOfWork.execute(async () => {
      const existing = await this.getById(id);
      const name = input.name?.trim();
      if (name !== undefined) {
        const sameName = await this.prisma.tag.findUnique({ where: { name } });
        if (sameName && sameName.id !== id) {
          throw duplicateTagNameError();
        }
      }
      // undefined = leave unchanged; Prisma skips undefined fields
      const updated = await mapUniqueViolation(
        () =>
          this.prisma.tag.update({
            where: { id },
            data: {
              name,
              description: input.description === undefined ? undefined : normalizeDescription(input.description),
              isActive: input.isActive,
            },
          }),
        duplicateTagNameError,
      );
      await this.auditLogService.record({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.TAG,
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}
