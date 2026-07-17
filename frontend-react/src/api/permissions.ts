import { apiClient } from './client';
import type { ApiItemResponse, ApiListResponse, Permission } from './types';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreatePermissionInput {
  name: string;
  description: string;
}

export type UpdatePermissionInput = Partial<CreatePermissionInput>;

export async function listPermissions(params: ListParams): Promise<ApiListResponse<Permission>> {
  const res = await apiClient.get<ApiListResponse<Permission>>('/permissions', { params });
  return res.data;
}

export async function getPermission(id: string): Promise<Permission> {
  const res = await apiClient.get<ApiItemResponse<Permission>>(`/permissions/${id}`);
  return res.data.data;
}

export async function createPermission(input: CreatePermissionInput): Promise<Permission> {
  const res = await apiClient.post<ApiItemResponse<Permission>>('/permissions', input);
  return res.data.data;
}

export async function updatePermission(id: string, input: UpdatePermissionInput): Promise<Permission> {
  const res = await apiClient.patch<ApiItemResponse<Permission>>(`/permissions/${id}`, input);
  return res.data.data;
}

export async function deletePermission(id: string): Promise<void> {
  await apiClient.delete(`/permissions/${id}`);
}
