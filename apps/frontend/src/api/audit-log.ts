import { axiosInstance, handleError, type APIResponse, type SuccessResponse } from './service';
import { type ListAuditLogQuery, type ListAuditLogResponse } from '@repo/shared';

export const AuditLogAPI = {
  listAuditLogs: async (query: ListAuditLogQuery): Promise<APIResponse<ListAuditLogResponse>> => {
    try {
      const resp = await axiosInstance.get<SuccessResponse<ListAuditLogResponse>>('/audit-logs', { params: query });
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
};
