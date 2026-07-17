import { apiClient } from './client';
import type { ApiItemResponse, CurrentUser } from './types';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const res = await apiClient.post<ApiItemResponse<PublicUser>>('/auth/register', input);
  return res.data.data;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const res = await apiClient.post<ApiItemResponse<LoginResult>>('/auth/login', input);
  return res.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const res = await apiClient.get<ApiItemResponse<CurrentUser>>('/auth/me');
  return res.data.data;
}
