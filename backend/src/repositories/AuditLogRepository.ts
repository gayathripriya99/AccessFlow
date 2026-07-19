import { FilterQuery, Types } from 'mongoose';
import { AuditAction, AuditLog, AuditLogDocument } from '../models/AuditLog';
import { PaginationParams } from '../utils/pagination';

export interface RecordAuditEventInput {
  userId?: Types.ObjectId | string | null;
  action: AuditAction;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListAuditLogsFilter {
  action?: AuditAction;
  userId?: string;
  from?: Date;
  to?: Date;
}

export class AuditLogRepository {
  async record(input: RecordAuditEventInput): Promise<void> {
    await AuditLog.create({
      userId: input.userId ?? null,
      action: input.action,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  }

  async list(
    filter: ListAuditLogsFilter,
    pagination: PaginationParams,
  ): Promise<{ items: AuditLogDocument[]; total: number }> {
    const query: FilterQuery<AuditLogDocument> = {};
    if (filter.action) {
      query.action = filter.action;
    }
    if (filter.userId) {
      query.userId = filter.userId;
    }
    if (filter.from || filter.to) {
      query.createdAt = {};
      if (filter.from) {
        query.createdAt.$gte = filter.from;
      }
      if (filter.to) {
        query.createdAt.$lte = filter.to;
      }
    }

    // Newest first — unlike Permission/Role's alphabetical list, an audit
    // trail is inherently chronological. Actor populated here (unlike
    // Role/User's unpopulated lists) since showing *who* did something is
    // the entire point of this view, not an extra fetch away.
    const [items, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .populate('userId', 'name email')
        .exec(),
      AuditLog.countDocuments(query).exec(),
    ]);
    return { items, total };
  }
}
