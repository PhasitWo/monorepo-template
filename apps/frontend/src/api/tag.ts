import { axiosInstance, handleError, type APIResponse, type SuccessResponse } from './service';
import {
  type CreateTagBody,
  type ListTagQuery,
  type ListTagResponse,
  type TagDetailResponse,
  type UpdateTagBody,
} from '@repo/shared';

export const TagAPI = {
  getTagById: async (id: string): Promise<APIResponse<TagDetailResponse>> => {
    try {
      const resp = await axiosInstance.get<SuccessResponse<TagDetailResponse>>(`/tags/${id}`);
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
  listTags: async (query: ListTagQuery): Promise<APIResponse<ListTagResponse>> => {
    try {
      const resp = await axiosInstance.get<SuccessResponse<ListTagResponse>>('/tags', {
        params: query,
      });
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
  createTag: async (body: CreateTagBody): Promise<APIResponse<TagDetailResponse>> => {
    try {
      const resp = await axiosInstance.post<SuccessResponse<TagDetailResponse>>('/tags', body);
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
  updateTag: async (id: string, body: UpdateTagBody): Promise<APIResponse<TagDetailResponse>> => {
    try {
      const resp = await axiosInstance.put<SuccessResponse<TagDetailResponse>>(`/tags/${id}`, body);
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
};
