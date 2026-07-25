import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

export interface RoleDocument extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description: string;
  permissions: Types.ObjectId[];
  /** Advanced RBAC (Phase 7): a role optionally inherits its parent's
   * (and the parent's ancestors', transitively) permissions. Null means
   * no parent — a plain, flat role, same as every role before Phase 7.
   * Always within the same tenant — cross-tenant parents are never created,
   * since RoleRepository resolves a proposed parent scoped to the caller's
   * own tenantId. */
  parentRole: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: {
      type: [Schema.Types.ObjectId],
      ref: 'Permission',
      default: [],
    },
    parentRole: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
      index: true,
    },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

// Phase 9: role names are unique per-tenant, not global.
roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Role = model<RoleDocument>('Role', roleSchema);
