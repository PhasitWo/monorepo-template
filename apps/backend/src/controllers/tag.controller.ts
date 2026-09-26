import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateTagBody, ListTagQuery, ListTagResponse, TagDetailResponse, UpdateTagBody } from '@repo/shared';
import { Tag } from '../.generated/client';
import { BaseController } from './baseController';
import { TagService } from '../services/tag.service';

function mapToTagDetailResponse(tag: Tag): TagDetailResponse {
  return {
    id: tag.id,
    runningId: tag.runningId,
    runningCode: tag.runningCode,
    name: tag.name,
    description: tag.description,
    isActive: tag.isActive,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

export class TagController extends BaseController {
  constructor(private readonly tagService: TagService) {
    super('TagController');
  }

  getTagById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tag = await this.tagService.getById(id);
    return this.successResponse(reply, mapToTagDetailResponse(tag));
  };

  listTag = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sortBy, sortOrder, search, ...rest } = request.query as ListTagQuery;
    const { page, all, pageSize, filters, isActive } = this.processPagination(rest);

    const { total, data } = await this.tagService.list({
      page,
      pageSize,
      sortBy,
      sortOrder,
      all,
      search,
      filters,
      isActive,
    });

    const resp: ListTagResponse = data.map(mapToTagDetailResponse);

    if (all) {
      return this.successResponse(reply, resp);
    }
    return this.paginatedResponse(reply, resp, this.buildPaginationMeta(page, pageSize, total));
  };

  createTag = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateTagBody;
    const tag = await this.tagService.create(body);
    return this.createdResponse(reply, mapToTagDetailResponse(tag));
  };

  updateTag = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateTagBody;
    const tag = await this.tagService.update(id, body);
    return this.successResponse(reply, mapToTagDetailResponse(tag));
  };
}
