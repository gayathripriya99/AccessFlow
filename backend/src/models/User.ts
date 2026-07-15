import { Schema, model, Document, Types } from 'mongoose';

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  // Roles/permissions resolution arrives in Phase 2/3 — this field is
  // reserved now so the schema doesn't need a breaking migration later.
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
  { timestamps: true },
);

export const User = model<UserDocument>('User', userSchema);
