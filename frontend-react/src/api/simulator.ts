import { apiClient } from './client';
import type { ApiItemResponse, SimulationResult } from './types';

export type SimulateInput =
  | { mode: 'user'; userId: string; permission: string }
  | { mode: 'roles'; roleIds: string[]; permission: string };

export async function simulate(input: SimulateInput): Promise<SimulationResult> {
  const res = await apiClient.post<ApiItemResponse<SimulationResult>>('/simulator/check', input);
  return res.data.data;
}
