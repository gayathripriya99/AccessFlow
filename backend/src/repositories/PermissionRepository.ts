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
  findByName(tenantId: string | Types.ObjectId, name: string): Promise<PermissionDocument | null> {
    return Permission.findOne({ tenantId, name: name.toLowerCase() }).exec();
  }

  findById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<PermissionDocument | null> {
    return Permission.findOne({ _id: id, tenantId }).exec();
  }

  create(tenantId: string | Types.ObjectId, input: CreatePermissionInput): Promise<PermissionDocument> {
    return Permission.create({ ...input, tenantId });
  }

  async list(
    tenantId: string | Types.ObjectId,
    filter: ListPermissionsFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PermissionDocument[]; total: number }> {
    const query: Record<string, unknown> = { tenantId };
    if (filter.search) {
      query.name = { $regex: filter.search, $options: 'i' };
    }
    const [items, total] = await Promise.all([
      Permission.find(query).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      Permission.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: UpdatePermissionInput,
  ): Promise<PermissionDocument | null> {
    return Permission.findOneAndUpdate({ _id: id, tenantId }, input, { new: true, runValidators: true }).exec();
  }

  async deleteById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
  ): Promise<PermissionDocument | null> {
    const deleted = await Permission.findOneAndDelete({ _id: id, tenantId }).exec();
    if (deleted) {
      await Role.updateMany({ tenantId, permissions: deleted._id }, { $pull: { permissions: deleted._id } }).exec();
    }
    return deleted;
  }
}
