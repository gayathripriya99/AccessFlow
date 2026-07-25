import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

export interface PermissionDocument extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<PermissionDocument>(
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
  },
  { timestamps: true, toJSON: toJSONOptions },
);

// Phase 9: permission names are unique per-tenant, not global.
permissionSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Permission = model<PermissionDocument>('Permission', permissionSchema);
