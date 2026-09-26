import pino from 'pino';

import type { FastifyReply } from 'fastify';
import { ErrorHandler } from '../common/errors/errorHandler';
import { appConfig } from '../common/config/appConfig';
import { ValidationError } from '../common/errors/errorTypes';
import { filterQuery, filterQuerySchema } from '@repo/shared';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  meta?: { pagination?: PaginationMeta };
}

export abstract class BaseController {
  protected readonly logger: pino.Logger;
  protected readonly errorHandler: ErrorHandler;

  constructor(name: string) {
    this.logger = pino({ name });
    this.errorHandler = new ErrorHandler();
  }

  protected successResponse<T>(reply: FastifyReply, data: T, statusCode: number = 200): FastifyReply {
    const response: SuccessResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    return reply.status(statusCode).send(response);
  }

  protected paginatedResponse<T>(
    reply: FastifyReply,
    data: T,
    pagination: PaginationMeta,
    statusCode: number = 200,
  ): FastifyReply {
    const response: SuccessResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      meta: { pagination },
    };
    return reply.status(statusCode).send(response);
  }

  protected createdResponse<T>(reply: FastifyReply, data: T): FastifyReply {
    return this.successResponse(reply, data, 201);
  }

  protected noContentResponse(reply: FastifyReply): FastifyReply {
    return this.successResponse(reply, null, 204);
  }

  protected processPagination(params: {
    page?: string;
    pageSize?: string;
    all?: string;
    filters?: string;
    isActive?: string;
  }): {
    page: number;
    pageSize: number;
    all: boolean;
    filters?: filterQuery | undefined;
    isActive?: boolean | undefined;
  } {
    let page: number;
    let pageSize: number;
    let all: boolean;
    let parsedFilters: filterQuery | undefined;
    let isActive: boolean | undefined;
    try {
      page = params.page ? parseInt(params.page, 10) : 1;
      pageSize = Math.min(
        params.pageSize ? parseInt(params.pageSize, 10) : appConfig.PAGINATION.DEFAULT_PAGE_SIZE,
        appConfig.PAGINATION.MAX_PAGE_SIZE,
      );
      all = params.all === 'true';
      isActive = typeof params.isActive === 'string' ? params.isActive === 'true' : undefined;
      const filters = params.filters ? JSON.parse(params.filters) : undefined;
      parsedFilters = filters ? filterQuerySchema.parse(filters) : undefined;
    } catch (error) {
      this.logger.error({ error }, 'Failed to process pagination parameters');
      throw new ValidationError('Error processing pagination parameters', { originalError: error });
    }

    return { page, pageSize, all, filters: parsedFilters, isActive };
  }

  protected buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / pageSize);
    return {
      page,
      limit: pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
