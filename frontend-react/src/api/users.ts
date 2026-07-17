import { apiClient } from './client';
import type { ApiItemResponse, ApiListResponse, User } from './types';
import type { ListParams } from './permissions';

export interface ListUsersParams extends ListParams {
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  isActive?: boolean;
  roles?: string[];
}

export async function listUsers(params: ListUsersParams): Promise<ApiListResponse<User>> {
  const res = await apiClient.get<ApiListResponse<User>>('/users', { params });
  return res.data;
}

export async function getUser(id: string): Promise<User> {
  const res = await apiClient.get<ApiItemResponse<User>>(`/users/${id}`);
  return res.data.data;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const res = await apiClient.patch<ApiItemResponse<User>>(`/users/${id}`, input);
  return res.data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
