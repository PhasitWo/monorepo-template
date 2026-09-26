import { axiosInstance, handleError, type APIResponse, type SuccessResponse } from './service';
import {
  type CreateUserBody,
  type ListUsersQuery,
  type ListUsersResponse,
  type UpdateUserBody,
  type UserDetailResponse,
} from '@repo/shared';

export const UserAPI = {
  listUsers: async (query: ListUsersQuery): Promise<APIResponse<ListUsersResponse>> => {
    try {
      const resp = await axiosInstance.get<SuccessResponse<ListUsersResponse>>('/users', { params: query });
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
  createUser: async (body: CreateUserBody): Promise<APIResponse<UserDetailResponse>> => {
    try {
      const resp = await axiosInstance.post<SuccessResponse<UserDetailResponse>>('/users', body);
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
  updateUser: async (id: string, body: UpdateUserBody): Promise<APIResponse<UserDetailResponse>> => {
    try {
      const resp = await axiosInstance.put<SuccessResponse<UserDetailResponse>>(`/users/${id}`, body);
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
  deleteUser: async (id: string): Promise<APIResponse<null>> => {
    try {
      await axiosInstance.delete(`/users/${id}`);
      // 204 has no body, so build the success envelope here
      return { success: true, data: null, timestamp: new Date().toISOString() };
    } catch (err) {
      return handleError(err);
    }
  },
};
