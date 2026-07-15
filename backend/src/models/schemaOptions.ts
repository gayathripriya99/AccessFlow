import { Document } from 'mongoose';

/**
 * Applied to schemas whose documents are serialized directly in API
 * responses (Permission, Role, User) so clients always see `id`, never
 * Mongo's `_id`/`__v`. AuthService's hand-built DTOs don't need this since
 * they already shape their own plain objects.
 */
export const toJSONOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: Document, ret: Record<string, unknown>) => {
    delete ret._id;
    return ret;
  },
};
