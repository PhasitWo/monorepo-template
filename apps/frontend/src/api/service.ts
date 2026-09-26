import { STORAGE_KEY } from '@/constants';
import { TokenResponse } from '@repo/shared';
import axios, { AxiosError, AxiosResponse, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEY.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEY.CURRENT_USER);
}

// Keep track of the refresh state
let isRefreshing = false;
let failedQueue: QueueItem[] = [];

// Helper function to process the queued requests
const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      if (token) {
        prom.resolve(token);
      }
    }
  });
  failedQueue = [];
};

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<unknown> => {
    // Cast the config to our extended interface
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // Refresh on 401 once per request; auth endpoints are excluded so a wrong password surfaces as an error
    const isAuthRequest = originalRequest?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      // If a refresh is already happening, queue this request up and wait
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosInstance(originalRequest); // Replay original request
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      // Mark this request so we don't accidentally loop it if the refresh fails
      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        // Use standard axios here to avoid the interceptor loop
        axios
          .post<SuccessResponse<TokenResponse>>(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
            refreshToken: localStorage.getItem(STORAGE_KEY.REFRESH_TOKEN),
          })
          .then((resp) => {
            const { accessToken, refreshToken } = resp.data.data;

            // Store new tokens
            localStorage.setItem(STORAGE_KEY.ACCESS_TOKEN, accessToken);
            localStorage.setItem(STORAGE_KEY.REFRESH_TOKEN, refreshToken);

            // Update default headers for future requests
            axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

            // Update the original failed request header
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }

            // Resolve everything in the waiting line
            processQueue(null, accessToken);

            // Replay the original request that failed
            resolve(axiosInstance(originalRequest));
          })
          .catch((refreshError: unknown) => {
            processQueue(refreshError, null);

            clearSession();
            // HashRouter: reload so the app restarts on the login route with no session
            window.location.hash = '#/login';
            window.location.reload();

            reject(refreshError);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  },
);

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
  meta?: { pagination?: PaginationMeta };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    traceId?: string;
    data?: unknown;
  };
  timestamp?: string;
  path: string;
}

export type APIResponse<T> = SuccessResponse<T> | ExtendedErrorResponse;

interface ExtendedErrorResponse extends ErrorResponse {
  status: number;
}

const genericError = (err: unknown): ExtendedErrorResponse => ({
  success: false,
  error: {
    code: 'UNKNOWN_ERROR',
    message: err instanceof Error ? err.message : String(err),
  },
  path: 'UNKNOWN_PATH',
  status: 500,
});

const createError = (err: AxiosError<ErrorResponse>): ExtendedErrorResponse => ({
  success: false,
  error: {
    code: err.response?.data?.error?.code ?? 'UNKNOWN_ERROR',
    message: err.response?.data?.error?.message ?? err.message,
  },
  path: err.response?.data?.path ?? 'UNKNOWN_PATH',
  status: err.response?.status ?? 500,
});

export function handleError(err: unknown): ExtendedErrorResponse {
  if (isAxiosError<ErrorResponse>(err)) {
    return createError(err);
  }
  return genericError(err);
}
