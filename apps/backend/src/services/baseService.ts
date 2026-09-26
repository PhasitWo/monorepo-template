import { filterQuery, FilterQueryUnit } from '@repo/shared';
import { PrismaClient } from '../.generated/client';
import { appConfig } from '../common/config/appConfig';
import { ValidationError } from '../common/errors/errorTypes';
import { DatabaseClient } from '../common/database/databaseClient';
import { TransactionContext } from '../common/database/transactionContext';
import { PrismaDBClient } from '../common/database/types';

/** Paging, sorting and column filters shared by every list query. */
export interface ListParams {
  page?: number;
  pageSize?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: filterQuery;
}

export interface ListResult<T> {
  total: number;
  data: T[];
}

export class BaseService {
  /** The active unit-of-work transaction client, or the root client outside one. */
  protected get prisma(): PrismaDBClient {
    return TransactionContext.current() ?? DatabaseClient.getInstance();
  }

  /** Always the root client. Only for writes that must survive a surrounding rollback. */
  protected get rootPrisma(): PrismaClient {
    return DatabaseClient.getInstance();
  }

  /** `skip` / `take` for a page; both undefined when `all` is set. */
  protected pageArgs(params: Pick<ListParams, 'page' | 'pageSize' | 'all'>): { skip?: number; take?: number } {
    const { page = 1, pageSize = appConfig.PAGINATION.DEFAULT_PAGE_SIZE, all } = params;
    return all ? {} : { skip: (page - 1) * pageSize, take: pageSize };
  }

  /**
   * Turns the list query's `filters` into a Prisma `where`. `configs` is the allow-list: one transform per filterable
   * field; a filter on any other field is rejected with a 400.
   */
  protected transformToWhereClause<T>(
    filterquery: filterQuery | undefined,
    configs: Partial<Record<keyof T, (filterUnit: FilterQueryUnit) => object>>,
  ): object {
    if (!filterquery || filterquery.length === 0) {
      return {};
    }
    const results = [];
    for (const filterUnit of filterquery) {
      const transformFn = configs[filterUnit.f as keyof T];
      if (!transformFn) {
        throw new ValidationError(`Unsupported filter field: ${filterUnit.f}`);
      }
      results.push(transformFn(filterUnit));
    }
    return { AND: results };
  }

  protected transformToDropdownWhereClause(filterUnit: FilterQueryUnit): object {
    const { f: field, o: operator, v1: value } = filterUnit;
    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'neq':
        return { [field]: { not: value } };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  protected transformToNumberWhereClause(filterUnit: FilterQueryUnit): object {
    const { f: field, o: operator, v1: value } = filterUnit;
    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'neq':
        return { [field]: { not: value } };
      case 'gt':
        return { [field]: { gt: value } };
      case 'gte':
        return { [field]: { gte: value } };
      case 'lt':
        return { [field]: { lt: value } };
      case 'lte':
        return { [field]: { lte: value } };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  protected transformToStringWhereClause(filterUnit: FilterQueryUnit): object {
    const { f: field, o: operator, v1: value } = filterUnit;
    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'neq':
        return { [field]: { not: value } };
      case 'ct':
        return { [field]: { contains: value, mode: 'insensitive' } };
      case 'nct':
        return { [field]: { not: { contains: value, mode: 'insensitive' } } };
      case 'sw':
        return { [field]: { startsWith: value, mode: 'insensitive' } };
      case 'nsw':
        return { [field]: { not: { startsWith: value, mode: 'insensitive' } } };
      case 'ew':
        return { [field]: { endsWith: value, mode: 'insensitive' } };
      case 'new':
        return { [field]: { not: { endsWith: value, mode: 'insensitive' } } };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }

  protected transformToDateWhereClause(filterUnit: FilterQueryUnit): object {
    const { f: field, o: operator, v1: value1, v2: value2 } = filterUnit;
    if (typeof value1 !== 'string') {
      throw new Error(`Invalid value type for date filter: ${typeof value1}`);
    }
    if ((operator === 'btw' || operator === 'nbtw') && typeof value2 !== 'string') {
      throw new Error(`Invalid value type for date filter: ${typeof value2}`);
    }
    // normalize date
    const v1Start = new Date(value1);
    v1Start.setHours(0, 0, 0, 0); // Set to start of the day
    const v1End = new Date(value1);
    v1End.setHours(23, 59, 59, 999); // Set to end of the day
    const v2End = value2 ? new Date(value2) : undefined;
    if (v2End) v2End.setHours(23, 59, 59, 999); // Set to end of the day
    switch (operator) {
      case 'eq':
        return { [field]: { gte: v1Start, lte: v1End } };
      case 'neq':
        return { [field]: { not: { gte: v1Start, lte: v1End } } };
      case 'bf':
        return { [field]: { lt: v1Start } };
      case 'af':
        return { [field]: { gte: v1End } };
      case 'btw':
        return { [field]: { gte: v1Start, lte: v2End } };
      case 'nbtw':
        return { [field]: { not: { gte: v1Start, lte: v2End } } };
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
}
