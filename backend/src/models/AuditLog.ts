import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

/** Runtime array, not just a type, so the audit-log query API can validate
 * an `action` filter against it (see validators/auditLog.validators.ts)
 * without duplicating this list. */
export const AUDIT_ACTIONS = [
  'auth.register',
  'auth.login.success',
  'auth.login.failure',
  'auth.refresh',
  'auth.refresh.reuse_detected',
  'auth.logout',
  'permission.create',
  'permission.update',
  'permission.delete',
  'role.create',
  'role.update',
  'role.delete',
  'user.update',
  'user.delete',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

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
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: toJSONOptions,
    // Mongoose's default `minimize: true` strips empty-object fields (like
    // `metadata: {}`, the common case — most actions never pass explicit
    // metadata) before saving, silently breaking the documented `metadata:
    // Record<string, unknown>` contract. Disabled so it's always present.
    minimize: false,
  },
);

export const AuditLog = model<AuditLogDocument>('AuditLog', auditLogSchema);
