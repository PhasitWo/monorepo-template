import { FastifyInstance } from 'fastify';
import {
  createUserBodySchema,
  listUsersQuerySchema,
  listUsersResponseSchema,
  updateUserBodySchema,
  userDetailResponseSchema,
} from '@repo/shared';
import {
  baseSchema,
  commonErrorResponses,
  idParamsSchema,
  registerRoutes,
  successResponseSchema,
} from './routeBuilder';
import { useZodSchema } from '../common/utils/useZodSchema';
import { UnitOfWork } from '../common/database/unitOfWork';
import { AuditLogService } from '../services/auditLog.service';
import { UserService } from '../services/user.service';
import { UserController } from '../controllers/user.controller';

export const registerUserRoutes = (fastify: FastifyInstance): void => {
  const userService = new UserService(new UnitOfWork(), new AuditLogService());
  const controller = new UserController(userService);

  registerRoutes(fastify, [
    {
      path: '/users',
      method: 'post',
      options: {
        schema: {
          ...baseSchema('User', 'Create user', 'Create a new user'),
          body: useZodSchema(createUserBodySchema),
          response: {
            ...commonErrorResponses,
            201: successResponseSchema(userDetailResponseSchema, 'User created successfully'),
          },
        },
      },
      handler: controller.createUser,
    },
    {
      path: '/users/:id',
      method: 'get',
      options: {
        schema: {
          ...baseSchema('User', 'Get user by ID', 'Retrieve a user by ID'),
          params: idParamsSchema,
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(userDetailResponseSchema, 'User retrieved successfully'),
          },
        },
      },
      handler: controller.getUserById,
    },
    {
      path: '/users',
      method: 'get',
      options: {
        schema: {
          ...baseSchema('User', 'List users', 'Retrieve a paginated list of users'),
          querystring: useZodSchema(listUsersQuerySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(listUsersResponseSchema, 'Users retrieved successfully'),
          },
        },
      },
      handler: controller.listUsers,
    },
    {
      path: '/users/:id',
      method: 'put',
      options: {
        schema: {
          ...baseSchema('User', 'Update user', 'Update an existing user'),
          params: idParamsSchema,
          body: useZodSchema(updateUserBodySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(userDetailResponseSchema, 'User updated successfully'),
          },
        },
      },
      handler: controller.updateUser,
    },
    {
      path: '/users/:id',
      method: 'delete',
      options: {
        schema: {
          ...baseSchema('User', 'Delete user', 'Soft-delete a user and end all of their sessions'),
          params: idParamsSchema,
          response: {
            ...commonErrorResponses,
            204: successResponseSchema(undefined, 'User deleted successfully'),
          },
        },
      },
      handler: controller.deleteUser,
    },
  ]);
};
