import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateUserBody, ListUsersQuery, ListUsersResponse, UpdateUserBody, UserDetailResponse } from '@repo/shared';
import { BaseController } from './baseController';
import { SafeUser, UserService } from '../services/user.service';

function mapToUserDetailResponse(user: SafeUser): UserDetailResponse {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super('UserController');
  }

  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateUserBody;
    const user = await this.userService.create(body);
    return this.createdResponse(reply, mapToUserDetailResponse(user));
  };

  getUserById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = await this.userService.getById(id);
    return this.successResponse(reply, mapToUserDetailResponse(user));
  };

  listUsers = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sortBy, sortOrder, search, ...rest } = request.query as ListUsersQuery;
    const { page, all, pageSize } = this.processPagination(rest);

    const { total, data } = await this.userService.list({
      page,
      pageSize,
      sortBy,
      sortOrder,
      all,
      search,
    });

    const resp: ListUsersResponse = data.map(mapToUserDetailResponse);

    if (all) {
      return this.successResponse(reply, resp);
    }
    return this.paginatedResponse(reply, resp, this.buildPaginationMeta(page, pageSize, total));
  };

  updateUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateUserBody;
    const user = await this.userService.update(id, body);
    return this.successResponse(reply, mapToUserDetailResponse(user));
  };

  deleteUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await this.userService.delete(id);
    return this.noContentResponse(reply);
  };
}
