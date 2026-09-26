import z from 'zod';

import { toJSONSchema } from '../common/utils/zodToJsonSchema';

import type { FastifyInstance, FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

interface RouteOptions {
  preHandler?:
    | ((req: FastifyRequest, reply: FastifyReply) => Promise<void>)
    | ((req: FastifyRequest, reply: FastifyReply) => Promise<void>)[];
  schema: Record<string, unknown>;
}

interface RouteConfig {
  method: HttpMethod;
  path: string;
  options: RouteOptions;
  handler: RouteHandlerMethod;
}

export const createRouteMethod =
  (fastify: FastifyInstance) =>
  (method: HttpMethod, path: string, options: RouteOptions, handler: RouteHandlerMethod): void => {
    const { preHandler, schema, ...rest } = options;

    fastify[method](
      path,
      {
        ...(preHandler ? { preHandler } : {}),
        schema,
        ...rest,
      },
      handler,
    );
  };

export const registerRoutes = (fastify: FastifyInstance, routes: RouteConfig[]): void => {
  const route = createRouteMethod(fastify);
  for (const { method, path, options, handler } of routes) {
    route(method, path, options, handler);
  }
};

// ──────────────────────────────────────────────
// Schema helpers
// ──────────────────────────────────────────────

/** Wraps a Zod or plain JSON schema into a standard success-response envelope. */
export const successResponseSchema = (
  dataSchema?: Record<string, unknown> | z.ZodType,
  description?: string,
): Record<string, unknown> => ({
  description,
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    success: { type: 'boolean', example: true },
    ...(dataSchema !== undefined
      ? { data: dataSchema instanceof z.ZodType ? toJSONSchema(dataSchema) : dataSchema }
      : {}),
    meta: { type: 'object', additionalProperties: true, nullable: true },
    timestamp: { type: 'string', format: 'date-time' },
  },
});

/** Builds a standard error-response JSON schema object. */
export const errorResponseSchema = (description: string, codeExample?: string): Record<string, unknown> => ({
  description,
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object' as const,
      additionalProperties: true,
      properties: {
        code: { type: 'string', example: codeExample ?? 'common.validation_error' },
        message: { type: 'string', example: 'Validation error message' },
      },
    },
    timestamp: { type: 'string', format: 'date-time' },
    path: { type: 'string' },
  },
});

/** Pre-built error responses for common HTTP status codes. */
export const commonErrorResponses = {
  400: errorResponseSchema('Invalid request', 'common.invalid_request'),
  401: errorResponseSchema('Authentication required / Invalid token', 'common.unauthorized'),
  403: errorResponseSchema('Forbidden', 'common.forbidden'),
  404: errorResponseSchema('Not found', 'common.not_found'),
  409: errorResponseSchema('Conflict', 'common.conflict'),
  500: errorResponseSchema('Internal server error', 'common.internal_server_error'),
};

/** Fastify-native (JSON schema) validation for `/:id` path params. */
export const idParamsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
  required: ['id'],
};

/** Base OpenAPI schema shared by all authenticated routes. */
export const baseSchema = (tag: string, summary: string, description: string): Record<string, unknown> => ({
  tags: [tag],
  summary,
  description,
  security: [{ bearerAuth: [] }],
});

/** Base OpenAPI schema for public (unauthenticated) routes. */
export const publicSchema = (tag: string, summary: string, description: string): Record<string, unknown> => ({
  tags: [tag],
  summary,
  description,
});
