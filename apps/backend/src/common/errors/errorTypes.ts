export interface ErrorOptions {
  code?: string;
  data?: unknown;
}

/**
 * Base error class for all application errors
 * Provides consistent error structure and metadata
 */
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
  data?: unknown;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging and responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

export class CustomError extends BaseError {
  statusCode = 500;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(
    message: string = 'something went wrong',
    context?: Record<string, unknown>,
    options?: ErrorOptions & { statusCode?: number },
  ) {
    super(message, context);
    this.statusCode = options?.statusCode ?? 500;
    this.errorCode = options?.code ?? 'common.internal_server_error';
    this.data = options?.data;
  }
}

/**
 * 400 Bad Request - Validation errors, malformed requests
 */
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(
    message: string = 'Invalid request data',
    context?: Record<string, unknown>,
    options?: ErrorOptions & { statusCode?: number },
  ) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.invalid_request';
    this.data = options?.data;
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends BaseError {
  readonly statusCode = 401;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Authentication required', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.unauthorized';
    this.data = options?.data;
  }
}

/**
 * 403 Forbidden - Access denied, insufficient permissions
 */
export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Access denied', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.forbidden';
    this.data = options?.data;
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Resource not found', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.not_found';
    this.data = options?.data;
  }
}

/**
 * 409 Conflict - Resource conflict (e.g., duplicate email)
 */
export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Resource conflict', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.conflict';
    this.data = options?.data;
  }
}

/**
 * 422 Unprocessable Entity - Business logic validation errors
 */
export class UnprocessableEntityError extends BaseError {
  readonly statusCode = 422;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Unprocessable entity', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.unprocessable_entity';
    this.data = options?.data;
  }
}

/**
 * 500 Internal Server Error - Unexpected server errors
 */
export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Internal server error', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.internal_server_error';
    this.data = options?.data;
  }
}

/**
 * 502 Bad Gateway - External service errors
 */
export class BadGatewayError extends BaseError {
  readonly statusCode = 502;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Bad gateway', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.bad_gateway';
    this.data = options?.data;
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
export class ServiceUnavailableError extends BaseError {
  readonly statusCode = 503;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Service unavailable', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.service_unavailable';
    this.data = options?.data;
  }
}

/**
 * 412 Precondition Failed - ETag / version mismatch (optimistic concurrency)
 */
export class PreconditionFailedError extends BaseError {
  readonly statusCode = 412;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Precondition failed', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.precondition_failed';
    this.data = options?.data;
  }
}

/**
 * 504 Gateway Timeout - External service timeout
 */
export class GatewayTimeoutError extends BaseError {
  readonly statusCode = 504;
  readonly errorCode: string;
  readonly isOperational = true;

  constructor(message: string = 'Gateway timeout', context?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, context);
    this.errorCode = options?.code ?? 'common.gateway_timeout';
    this.data = options?.data;
  }
}

/**
 * Type guard to check if error is operational
 */
export function isOperationalError(error: unknown): error is BaseError {
  return error instanceof BaseError && error.isOperational;
}

/**
 * Type guard to check if error is a BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}
