import { apiClient } from './client';
import type { ApiListResponse, AuditAction, AuditLogEntry } from './types';

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  action?: AuditAction;
  userId?: string;
  from?: string;
  to?: string;
}

export async function listAuditLogs(params: ListAuditLogsParams): Promise<ApiListResponse<AuditLogEntry>> {
  const res = await apiClient.get<ApiListResponse<AuditLogEntry>>('/audit-logs', { params });
  return res.data;
}
