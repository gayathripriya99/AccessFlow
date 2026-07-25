import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

/**
 * Multi-tenant (Phase 9) root — every tenant-scoped model (User, Role,
 * Permission, Policy, AuditLog) carries a `tenantId` referencing one of
 * these. `slug` is the one thing that stays *globally* unique (by
 * definition — it's how a tenant is looked up before any tenant context
 * exists, at register/login time, from an unauthenticated request).
 */
export interface TenantDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<TenantDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

export const Tenant = model<TenantDocument>('Tenant', tenantSchema);
