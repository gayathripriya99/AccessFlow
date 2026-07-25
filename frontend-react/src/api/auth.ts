import { apiClient } from './client';
import type { ApiItemResponse, CurrentUser } from './types';

// Phase 9: registering either starts a brand-new organization (the
// registrant becomes its admin) or joins an existing one by slug, as a
// roleless user — mirrors the backend's discriminated register body.
export type RegisterInput =
  | { mode: 'create'; email: string; password: string; name: string; tenantName: string; tenantSlug: string }
  | { mode: 'join'; email: string; password: string; name: string; tenantSlug: string };

export interface LoginInput {
  email: string;
  password: string;
  tenantSlug: string;
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
