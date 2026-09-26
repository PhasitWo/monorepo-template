import { FastifyInstance } from 'fastify';
import { loginBodySchema, refreshTokenBodySchema, tokenResponseSchema } from '@repo/shared';
import { commonErrorResponses, publicSchema, registerRoutes, successResponseSchema } from './routeBuilder';
import { useZodSchema } from '../common/utils/useZodSchema';
import { UnitOfWork } from '../common/database/unitOfWork';
import { AuditLogService } from '../services/auditLog.service';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';

export const registerAuthRoutes = (fastify: FastifyInstance): void => {
  const unitOfWork = new UnitOfWork();
  const auditLogService = new AuditLogService();
  const userService = new UserService(unitOfWork, auditLogService);
  const authService = new AuthService(userService, unitOfWork, auditLogService);
  const controller = new AuthController(authService);

  registerRoutes(fastify, [
    {
      path: '/auth/login',
      method: 'post',
      options: {
        schema: {
          ...publicSchema('Auth', 'Login', 'Authenticate user and return access & refresh tokens'),
          body: useZodSchema(loginBodySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(tokenResponseSchema, 'Login successful'),
          },
        },
      },
      handler: controller.login,
    },
    {
      path: '/auth/refresh',
      method: 'post',
      options: {
        schema: {
          ...publicSchema('Auth', 'Refresh Token', 'Use refresh token to get new access & refresh tokens'),
          body: useZodSchema(refreshTokenBodySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(tokenResponseSchema, 'Tokens refreshed successfully'),
          },
        },
      },
      handler: controller.refresh,
    },
  ]);
};
