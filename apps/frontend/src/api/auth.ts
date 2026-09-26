import { axiosInstance, handleError, type APIResponse, type SuccessResponse } from './service';
import { LoginBody, TokenResponse } from '@repo/shared';

export const AuthAPI = {
  login: async (body: LoginBody): Promise<APIResponse<TokenResponse>> => {
    try {
      const resp = await axiosInstance.post<SuccessResponse<TokenResponse>>(`/auth/login`, body);
      return resp.data;
    } catch (err) {
      return handleError(err);
    }
  },
};
