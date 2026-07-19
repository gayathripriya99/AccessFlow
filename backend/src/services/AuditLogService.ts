import { AuditLogDocument } from '../models/AuditLog';
import { AuditLogRepository, ListAuditLogsFilter } from '../repositories/AuditLogRepository';
import { PaginationMeta, PaginationParams, buildPaginationMeta } from '../utils/pagination';

export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async list(
    filter: ListAuditLogsFilter,
    pagination: PaginationParams,
  ): Promise<{ items: AuditLogDocument[]; meta: PaginationMeta }> {
    const { items, total } = await this.auditLogRepository.list(filter, pagination);
    return { items, meta: buildPaginationMeta(pagination, total) };
  }
}
