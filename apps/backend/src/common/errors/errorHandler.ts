import pino from 'pino';

import {
  BaseError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errorTypes';

import type { FastifyReply, FastifyRequest } from 'fastify';

const logger = pino({ name: 'ErrorHandler' });

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId?: string;
    data?: unknown;
  };
  timestamp: string;
  path: string;
}

/**
 * Centralized error handler for consistent error processing
 * across all controllers and routes
 */
export class ErrorHandler {
  /**
   * Handle errors in controller methods
   */
  async handle(error: unknown, request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const processedError = this.processError(error);
    const errorResponse = this.buildErrorResponse(processedError, request);

    // Log the error with appropriate level
    const logLevel = processedError.statusCode >= 500 ? 'error' : 'warn';
    logger[logLevel](
      {
        error: {
          name: processedError.name,
          message: processedError.message,
          code: processedError.errorCode,
          statusCode: processedError.statusCode,
          stack: processedError.stack,
          context: processedError.context,
        },
        request: {
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
        },
      },
      `${processedError.statusCode} error in request processing`,
    );

    return reply.status(processedError.statusCode).send(errorResponse);
  }

  /**
   * Process unknown errors and convert them to BaseError instances
   */
  private processError(error: unknown): BaseError {
    if (error instanceof BaseError) {
      return error;
    }

    // Unique-constraint race not mapped by a service (Prisma P2002). Duck-typed to keep Prisma out of this layer.
    if ((error as { code?: unknown })?.code === 'P2002') {
      return new ConflictError('Resource conflict: a unique value is already in use', {
        originalError: (error as Error).name,
      });
    }

    // Handle Fastify schema validation errors (statusCode=400 with validation property)
    const maybeValidationError = error as { statusCode?: number; validation?: unknown; message?: string };
    if (maybeValidationError?.statusCode === 400 && maybeValidationError?.validation !== undefined) {
      return new ValidationError(maybeValidationError.message || 'Invalid request data', {
        validation: maybeValidationError.validation,
      });
    }

    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        return new ValidationError(errorMessage, { originalError: error.name });
      }

      if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        return new NotFoundError(errorMessage, { originalError: error.name });
      }

      if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
        return new UnauthorizedError(errorMessage, { originalError: error.name });
      }

      if (errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
        return new ForbiddenError(errorMessage, { originalError: error.name });
      }

      if (errorMessage.includes('conflict') || errorMessage.includes('duplicate')) {
        return new ConflictError(errorMessage, { originalError: error.name });
      }
    }

    // Default to internal server error for unknown errors
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : (error as Error)?.message || 'Unknown error';

    return new InternalServerError(message, {
      originalError: (error as Error)?.name || 'UnknownError',
      stack: (error as Error)?.stack,
    });
  }

  /**
   * Build standardized error response
   */
  private buildErrorResponse(error: BaseError, request: FastifyRequest): ErrorResponse {
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldHideDetails = isProduction && error.statusCode >= 500;
    const optionalData = error.data;

    return {
      success: false,
      error: {
        code: error.errorCode,
        message: shouldHideDetails ? 'Internal server error' : error.message,
        details: shouldHideDetails ? undefined : error.context,
        data: optionalData,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };
  }
}

/**
 * Setup global error handlers for unhandled errors
 */
export function setupGlobalErrorHandling(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal(
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      },
      'Uncaught exception occurred',
    );

    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.fatal(
      {
        error: reason,
        promise: promise.toString(),
      },
      'Unhandled promise rejection occurred',
    );

    setTimeout(() => process.exit(1), 1000);
  });
}
