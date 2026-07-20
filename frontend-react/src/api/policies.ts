import { apiClient } from './client';
import type { ApiItemResponse, ApiListResponse, Policy, PolicyAction, PolicyCondition, PolicyEffect, PolicyResource } from './types';
import type { ListParams } from './permissions';

export interface CreatePolicyInput {
  name: string;
  description: string;
  resource: PolicyResource;
  action: PolicyAction;
  effect: PolicyEffect;
  conditions: PolicyCondition[];
  enabled?: boolean;
}

export type UpdatePolicyInput = Partial<CreatePolicyInput>;

export async function listPolicies(params: ListParams): Promise<ApiListResponse<Policy>> {
  const res = await apiClient.get<ApiListResponse<Policy>>('/policies', { params });
  return res.data;
}

export async function getPolicy(id: string): Promise<Policy> {
  const res = await apiClient.get<ApiItemResponse<Policy>>(`/policies/${id}`);
  return res.data.data;
}

export async function createPolicy(input: CreatePolicyInput): Promise<Policy> {
  const res = await apiClient.post<ApiItemResponse<Policy>>('/policies', input);
  return res.data.data;
}

export async function updatePolicy(id: string, input: UpdatePolicyInput): Promise<Policy> {
  const res = await apiClient.patch<ApiItemResponse<Policy>>(`/policies/${id}`, input);
  return res.data.data;
}

export async function deletePolicy(id: string): Promise<void> {
  await apiClient.delete(`/policies/${id}`);
}
