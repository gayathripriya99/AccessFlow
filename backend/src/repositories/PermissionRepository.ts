import { Types } from 'mongoose';
import { Permission, PermissionDocument } from '../models/Permission';
import { Role } from '../models/Role';
import { PaginationParams } from '../utils/pagination';

export interface CreatePermissionInput {
  name: string;
  description: string;
}

export interface UpdatePermissionInput {
  name?: string;
  description?: string;
}

export interface ListPermissionsFilter {
  search?: string;
}

export class PermissionRepository {
  findByName(name: string): Promise<PermissionDocument | null> {
    return Permission.findOne({ name: name.toLowerCase() }).exec();
  }

  findById(id: string | Types.ObjectId): Promise<PermissionDocument | null> {
    return Permission.findById(id).exec();
  }

  create(input: CreatePermissionInput): Promise<PermissionDocument> {
    return Permission.create(input);
  }

  async list(
    filter: ListPermissionsFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PermissionDocument[]; total: number }> {
    const query = filter.search ? { name: { $regex: filter.search, $options: 'i' } } : {};
    const [items, total] = await Promise.all([
      Permission.find(query).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      Permission.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(id: string | Types.ObjectId, input: UpdatePermissionInput): Promise<PermissionDocument | null> {
    return Permission.findByIdAndUpdate(id, input, { new: true, runValidators: true }).exec();
  }

  async deleteById(id: string | Types.ObjectId): Promise<PermissionDocument | null> {
    const deleted = await Permission.findByIdAndDelete(id).exec();
    if (deleted) {
      await Role.updateMany({ permissions: deleted._id }, { $pull: { permissions: deleted._id } }).exec();
    }
    return deleted;
  }
}
