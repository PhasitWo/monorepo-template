import pino from 'pino';
import { AuditAction, AuditEntityType, AuditLog, Prisma } from '../.generated/client';
import { AuditContext, getAuditContext } from '../common/context/auditContext';
import { PrismaDBClient } from '../common/database/types';
import { AuditDiff, computeDiff } from '../common/utils/computeDiff';
import { BaseService, ListParams, ListResult } from './baseService';

const logger = pino({ name: 'AuditLogService' });

/**
 * Relation / derived fields that are loaded for display and are not the record's own state,
 * e.g. `[AuditEntityType.ORDER]: ['customerName', 'items']`.
 */
const EXCLUDED_FIELDS: Partial<Record<AuditEntityType, string[]>> = {};

export interface AuditEntry {
  action: AuditAction;
  entityType: AuditEntityType | null;
  entityId: string | null;
  /** Record before the change. Only used for UPDATE-like actions. */
  before?: object;
  /** Record after the change. Only used for UPDATE-like actions. */
  after?: object;
  metadata?: Record<string, unknown>;
  /** Overrides the actor from the request context, e.g. on login where no token exists yet. */
  actor?: { userId: string | null; username: string | null };
}

// a nullable Json column stores SQL NULL only when given Prisma.DbNull
const toJson = (value: unknown) => (value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue));

export class AuditLogService extends BaseService {
  constructor(private readonly getContext: () => AuditContext = getAuditContext) {
    super();
  }

  async list(params: ListParams): Promise<ListResult<AuditLog>> {
    const { sortBy = 'createdAt', sortOrder = 'desc', filters } = params;
    // allow-list: only these fields can be filtered, each with its operator set
    const where = this.transformToWhereClause<AuditLog>(filters, {
      entityType: this.transformToDropdownWhereClause,
      entityId: this.transformToDropdownWhereClause,
      action: this.transformToDropdownWhereClause,
      actorUserId: this.transformToDropdownWhereClause,
      createdAt: this.transformToDateWhereClause,
    });
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...this.pageArgs(params) }),
    ]);
    return { total, data };
  }

  /** Writes the audit row in the active unit of work. Failure rejects, rolling back the transaction. */
  async record(entry: AuditEntry): Promise<void> {
    await this.insert(this.prisma, entry);
  }

  /**
   * Writes the audit row on the root client, outside any transaction, so it survives a surrounding rollback.
   * Best-effort: failures are logged, never thrown.
   */
  async recordStandalone(entry: AuditEntry): Promise<void> {
    try {
      await this.insert(this.rootPrisma, entry);
    } catch (error) {
      logger.error({ err: error, action: entry.action }, 'Failed to write standalone audit log');
    }
  }

  private async insert(client: PrismaDBClient, entry: AuditEntry): Promise<void> {
    const ctx = this.getContext();
    const diff: AuditDiff | null =
      entry.before && entry.after
        ? computeDiff(entry.before, entry.after, {
            exclude: entry.entityType ? EXCLUDED_FIELDS[entry.entityType] : undefined,
          })
        : null;

    await client.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        diff: toJson(diff),
        metadata: toJson(entry.metadata ?? null),
        actorUserId: entry.actor ? entry.actor.userId : (ctx.actorUserId ?? null),
        actorUsername: entry.actor ? entry.actor.username : (ctx.actorUsername ?? null),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        requestId: ctx.requestId ?? null,
      },
    });
  }
}
