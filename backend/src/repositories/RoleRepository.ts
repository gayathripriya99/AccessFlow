import { Types } from 'mongoose';
import { Role, RoleDocument } from '../models/Role';
import { User } from '../models/User';
import { PaginationParams } from '../utils/pagination';

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions?: Types.ObjectId[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: Types.ObjectId[];
}

export interface ListRolesFilter {
  search?: string;
}

export class RoleRepository {
  findByName(name: string): Promise<RoleDocument | null> {
    return Role.findOne({ name: name.toLowerCase() }).exec();
  }

  findById(id: string | Types.ObjectId, populatePermissions = false): Promise<RoleDocument | null> {
    const query = Role.findById(id);
    if (populatePermissions) {
      query.populate('permissions');
    }
    return query.exec();
  }

  create(input: CreateRoleInput): Promise<RoleDocument> {
    return Role.create(input);
  }

  async list(
    filter: ListRolesFilter,
    pagination: PaginationParams,
  ): Promise<{ items: RoleDocument[]; total: number }> {
    const query = filter.search ? { name: { $regex: filter.search, $options: 'i' } } : {};
    const [items, total] = await Promise.all([
      Role.find(query).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      Role.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(id: string | Types.ObjectId, input: UpdateRoleInput): Promise<RoleDocument | null> {
    return Role.findByIdAndUpdate(id, input, { new: true, runValidators: true }).populate('permissions').exec();
  }

  async deleteById(id: string | Types.ObjectId): Promise<RoleDocument | null> {
    const deleted = await Role.findByIdAndDelete(id).exec();
    if (deleted) {
      await User.updateMany({ roles: deleted._id }, { $pull: { roles: deleted._id } }).exec();
    }
    return deleted;
  }
}
