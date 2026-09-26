import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { fastifyRequestContext } from '@fastify/request-context';
import 'dotenv/config';
import fastify from 'fastify';
import { DatabaseClient } from './common/database/databaseClient';
import { ErrorHandler, setupGlobalErrorHandling } from './common/errors/errorHandler';
import { validateEnv } from './common/config/validateEnv';
import { appConfig } from './common/config/appConfig';
import { zodValidatorCompilerPlugin } from './common/plugins/zodValidatorCompiler';
import { getSwaggerOptions, swaggerUiOptions } from './common/config/swaggerConfig';
import { AuthMiddleware } from './middlewares/authMiddleware';
import { Prisma } from './.generated/client';
import { registerAuthRoutes } from './routes/auth.routes';
import { registerUserRoutes } from './routes/user.routes';
import { registerTagRoutes } from './routes/tag.routes';
import { registerAuditLogRoutes } from './routes/auditLog.routes';

setupGlobalErrorHandling();

validateEnv();

async function createApp(): Promise<ReturnType<typeof fastify>> {
  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'local' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    },
  });

  await app.register(cors, {
    origin: appConfig.CORS_ORIGIN,
    methods: '*',
  });

  await app.register(zodValidatorCompilerPlugin);

  // per-request AsyncLocalStorage; AuthMiddleware fills in the actor for the audit log
  await app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({
      audit: {
        requestId: request.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      },
    }),
  });

  await app.register(swagger, getSwaggerOptions('API', 'Backend API', '1.0.0'));
  await app.register(swaggerUi, swaggerUiOptions);

  const errorHandler = new ErrorHandler();
  app.setErrorHandler((error, request, reply) => errorHandler.handle(error, request, reply));

  app.addHook('onClose', async () => {
    await DatabaseClient.disconnect();
  });

  // public routes
  await app.register(
    (instance) => {
      registerAuthRoutes(instance);
    },
    { prefix: '/api/v1' },
  );

  // authenticated routes: the hook covers every route registered here, so routes never add it themselves
  const authMiddleware = new AuthMiddleware();
  await app.register(
    (instance) => {
      instance.addHook('preHandler', authMiddleware.authenticate.bind(authMiddleware));
      registerUserRoutes(instance);
      registerTagRoutes(instance);
      registerAuditLogRoutes(instance);
    },
    { prefix: '/api/v1' },
  );

  app.get('/health', async () => {
    const dbClient = DatabaseClient.getInstance();
    await dbClient.$queryRaw(Prisma.sql`SELECT 1`);
    return { status: 'ok' };
  });

  app.get('/ping', async (_, res) => {
    return res.status(200).send({ message: 'pong' });
  });

  return app;
}

async function start(): Promise<void> {
  const app = await createApp();
  const port = Number(process.env.PORT) || 3000;

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export { createApp };

void start();
