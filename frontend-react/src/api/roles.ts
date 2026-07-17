import { apiClient } from './client';
import type { ApiItemResponse, ApiListResponse, Role } from './types';
import type { ListParams } from './permissions';

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions?: string[];
}

export type UpdateRoleInput = Partial<CreateRoleInput>;

export async function listRoles(params: ListParams): Promise<ApiListResponse<Role>> {
  const res = await apiClient.get<ApiListResponse<Role>>('/roles', { params });
  return res.data;
}

export async function getRole(id: string): Promise<Role> {
  const res = await apiClient.get<ApiItemResponse<Role>>(`/roles/${id}`);
  return res.data.data;
}

export async function createRole(input: CreateRoleInput): Promise<Role> {
  const res = await apiClient.post<ApiItemResponse<Role>>('/roles', input);
  return res.data.data;
}

export async function updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
  const res = await apiClient.patch<ApiItemResponse<Role>>(`/roles/${id}`, input);
  return res.data.data;
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`);
}
