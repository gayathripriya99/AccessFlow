import { Types } from 'mongoose';

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

export function toObjectIdArray(ids: string[]): Types.ObjectId[] {
  return ids.map((id) => new Types.ObjectId(id));
}
