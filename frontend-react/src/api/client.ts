import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, notifyAuthFailure, setAccessToken } from '../auth/tokenStore';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true, // sends the httpOnly refresh cookie automatically
});

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ data: { accessToken: string } }>(
        `${baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => res.data.data.accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const isAuthEndpoint = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/register');

    if (error.response?.status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true;
      try {
        const newAccessToken = await refreshAccessToken();
        setAccessToken(newAccessToken);
        config.headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiClient(config);
      } catch {
        setAccessToken(null);
        notifyAuthFailure();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
