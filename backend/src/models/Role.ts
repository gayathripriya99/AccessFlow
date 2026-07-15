import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

export interface RoleDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  permissions: Types.ObjectId[];
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
  },
  { timestamps: true, toJSON: toJSONOptions },
);

export const Role = model<RoleDocument>('Role', roleSchema);
