import { Schema, model, Document, Types } from 'mongoose';

export type AuditAction =
  | 'auth.register'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.refresh'
  | 'auth.refresh.reuse_detected'
  | 'auth.logout'
  | 'permission.create'
  | 'permission.update'
  | 'permission.delete'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'user.update'
  | 'user.delete';

export interface AuditLogDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  action: AuditAction;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);
