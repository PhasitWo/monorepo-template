import fastify, { FastifyInstance } from 'fastify';
import z from 'zod';
import { zodValidatorCompilerPlugin } from '../common/plugins/zodValidatorCompiler';
import { ErrorHandler } from '../common/errors/errorHandler';
import { useZodSchema } from '../common/utils/useZodSchema';
import { getSwaggerOptions } from '../common/config/swaggerConfig';
import { idParamsSchema, registerRoutes, successResponseSchema } from '../routes/routeBuilder';
import { validateEnv } from '../common/config/validateEnv';
import { listAuditLogResponseSchema } from '@repo/shared';

/**
 * Runs requests through a real Fastify instance (no database): validator compiler, error handler
 * and the route builder together, the way server.ts wires them.
 */
describe('HTTP pipeline', () => {
  let app: FastifyInstance;
  const bodySchema = z.object({ name: z.string().min(1) });

  beforeAll(async () => {
    app = fastify();
    await app.register(zodValidatorCompilerPlugin);
    const errorHandler = new ErrorHandler();
    app.setErrorHandler((error, request, reply) => errorHandler.handle(error, request, reply));
    registerRoutes(app, [
      {
        method: 'post',
        path: '/things/:id',
        options: {
          schema: {
            params: idParamsSchema,
            body: useZodSchema(bodySchema),
            response: { 200: successResponseSchema(bodySchema) },
          },
        },
        handler: async (request) => ({ success: true, data: request.body, timestamp: new Date().toISOString() }),
      },
      {
        // response schemas are compiled into serializers, so a schema the serializer can't handle only fails at runtime
        method: 'get',
        path: '/audit-logs',
        options: { schema: { response: { 200: successResponseSchema(listAuditLogResponseSchema) } } },
        handler: async () => ({
          success: true,
          data: [
            {
              id: 'a1',
              createdAt: '2026-01-01T00:00:00.000Z',
              action: 'UPDATE',
              entityType: 'TAG',
              entityId: 't1',
              diff: { name: ['Old', 'New'], description: [null, 'x'] },
              metadata: { reason: 'INVALID_PASSWORD' },
              actorUserId: 'u1',
              actorUsername: 'alice',
              ip: '::1',
              userAgent: 'jest',
              requestId: 'r1',
            },
          ],
          timestamp: new Date().toISOString(),
        }),
      },
      {
        method: 'get',
        path: '/boom',
        options: { schema: {} },
        handler: async () => {
          throw new Error('record not found');
        },
      },
    ]);
    await app.ready();
  });

  afterAll(() => app.close());

  const id = '7f3c2a58-2a5e-4d7e-9a53-5a3b7b0a2c11';

  it('accepts a valid request', async () => {
    const res = await app.inject({ method: 'POST', url: `/things/${id}`, payload: { name: 'x' } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, data: { name: 'x' } });
  });

  it('rejects an invalid Zod body with the standard 400 envelope', async () => {
    const res = await app.inject({ method: 'POST', url: `/things/${id}`, payload: { name: '' } });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false, error: { code: 'common.invalid_request' } });
  });

  it('rejects invalid JSON-schema params', async () => {
    const res = await app.inject({ method: 'POST', url: '/things/not-a-uuid', payload: { name: 'x' } });

    expect(res.statusCode).toBe(400);
  });

  it('serializes audit log diffs and metadata through the response schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/audit-logs' });

    expect(res.statusCode).toBe(200);
    expect(res.json().data[0]).toMatchObject({
      diff: { name: ['Old', 'New'], description: [null, 'x'] },
      metadata: { reason: 'INVALID_PASSWORD' },
    });
  });

  it('maps a plain "not found" error to 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ success: false, path: '/boom' });
  });

  it('converts Zod route schemas to OpenAPI JSON schema', () => {
    const { transform } = getSwaggerOptions('API', 'desc', '1.0.0');
    const result = transform!({ schema: { body: useZodSchema(bodySchema) }, url: '/x' } as never) as {
      schema: { body: Record<string, unknown> };
    };

    expect(result.schema.body).toMatchObject({ type: 'object', properties: { name: { type: 'string' } } });
    expect(result.schema.body).not.toHaveProperty('$zodSchema');
  });
});

describe('validateEnv', () => {
  const original = { ...process.env };
  let exit: jest.SpyInstance;
  let stderr: jest.SpyInstance;

  beforeEach(() => {
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it('applies defaults to a minimal environment', () => {
    process.env = { DATABASE_URL: 'postgresql://x' };

    expect(validateEnv()).toMatchObject({ NODE_ENV: 'local', PORT: '3000', MAX_PAGE_SIZE: '100' });
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits when DATABASE_URL is missing', () => {
    process.env = {};

    validateEnv();

    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.mock.calls.join('')).toContain('DATABASE_URL');
  });

  it('refuses to run production without a JWT secret', () => {
    process.env = { DATABASE_URL: 'postgresql://x', NODE_ENV: 'production' };

    validateEnv();

    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.mock.calls.join('')).toContain('JWT_SECRET');
  });
});
