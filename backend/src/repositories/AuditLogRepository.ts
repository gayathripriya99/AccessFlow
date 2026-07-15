import { Types } from 'mongoose';
import { AuditAction, AuditLog } from '../models/AuditLog';

export interface RecordAuditEventInput {
  userId?: Types.ObjectId | string | null;
  action: AuditAction;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
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
}
