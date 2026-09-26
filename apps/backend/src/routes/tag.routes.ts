import { FastifyInstance } from 'fastify';
import {
  createTagBodySchema,
  listTagQuerySchema,
  listTagResponseSchema,
  tagDetailResponseSchema,
  updateTagBodySchema,
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
import { TagService } from '../services/tag.service';
import { TagController } from '../controllers/tag.controller';

export const registerTagRoutes = (fastify: FastifyInstance): void => {
  // manual DI: services → controller
  const tagService = new TagService(new UnitOfWork(), new AuditLogService());
  const controller = new TagController(tagService);

  registerRoutes(fastify, [
    {
      method: 'get',
      path: '/tags/:id',
      options: {
        schema: {
          ...baseSchema('Tag', 'Get tag by ID', 'Retrieve a tag by ID'),
          params: idParamsSchema,
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(tagDetailResponseSchema, 'Tag retrieved successfully'),
          },
        },
      },
      handler: controller.getTagById,
    },
    {
      method: 'get',
      path: '/tags',
      options: {
        schema: {
          ...baseSchema('Tag', 'List tags', 'Retrieve a paginated list of tags'),
          querystring: useZodSchema(listTagQuerySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(listTagResponseSchema, 'Tags retrieved successfully'),
          },
        },
      },
      handler: controller.listTag,
    },
    {
      method: 'post',
      path: '/tags',
      options: {
        schema: {
          ...baseSchema('Tag', 'Create a tag', 'Create a tag'),
          body: useZodSchema(createTagBodySchema),
          response: {
            ...commonErrorResponses,
            201: successResponseSchema(tagDetailResponseSchema, 'Tag created successfully'),
          },
        },
      },
      handler: controller.createTag,
    },
    {
      method: 'put',
      path: '/tags/:id',
      options: {
        schema: {
          ...baseSchema('Tag', 'Update a tag', 'Update a tag'),
          params: idParamsSchema,
          body: useZodSchema(updateTagBodySchema),
          response: {
            ...commonErrorResponses,
            200: successResponseSchema(tagDetailResponseSchema, 'Tag updated successfully'),
          },
        },
      },
      handler: controller.updateTag,
    },
  ]);
};
