import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

export interface RoleDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  permissions: Types.ObjectId[];
  /** Advanced RBAC (Phase 7): a role optionally inherits its parent's
   * (and the parent's ancestors', transitively) permissions. Null means
   * no parent — a plain, flat role, same as every role before Phase 7. */
  parentRole: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

export const Role = model<RoleDocument>('Role', roleSchema);
