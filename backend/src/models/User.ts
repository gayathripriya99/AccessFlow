import { Schema, model, Document, Types } from 'mongoose';
import { toJSONOptions } from './schemaOptions';

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  // Wired up for real in Phase 2 (Role model + assignment endpoints).
  // Permission *evaluation* off of these roles is still Phase 3.
  roles: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    roles: {
      type: [Schema.Types.ObjectId],
      ref: 'Role',
      default: [],
    },
  },
  { timestamps: true, toJSON: toJSONOptions },
);

export const User = model<UserDocument>('User', userSchema);
