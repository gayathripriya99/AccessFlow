import { Types } from 'mongoose';
import { Role, RoleDocument } from '../models/Role';
import { User } from '../models/User';
import { PaginationParams } from '../utils/pagination';

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions?: Types.ObjectId[];
  parentRole?: Types.ObjectId | null;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: Types.ObjectId[];
  parentRole?: Types.ObjectId | null;
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
      query.populate('permissions').populate('parentRole', 'name');
    }
    return query.exec();
  }

  create(input: CreateRoleInput): Promise<RoleDocument> {
    return Role.create(input);
  }

  /**
   * Walks parentRole → parentRole → ... starting from (but not including)
   * `roleId`, each ancestor populated with its own permissions, so callers
   * can flatten a role's *effective* (own + inherited) permission set.
   * `maxDepth` is a defensive cap (real hierarchies should be a handful of
   * levels at most) — combined with `seen`, also guards against a cycle
   * that somehow got persisted despite create/update-time prevention.
   */
  async getAncestorChain(roleId: string | Types.ObjectId, maxDepth = 20): Promise<RoleDocument[]> {
    const ancestors: RoleDocument[] = [];
    const seen = new Set<string>([roleId.toString()]);

    const start = await Role.findById(roleId).select('parentRole').exec();
    let currentId = start?.parentRole ?? null;

    while (currentId && ancestors.length < maxDepth) {
      const idStr = currentId.toString();
      if (seen.has(idStr)) break;
      seen.add(idStr);

      const ancestor = await Role.findById(currentId).populate('permissions').exec();
      if (!ancestor) break;
      ancestors.push(ancestor);
      currentId = ancestor.parentRole;
    }

    return ancestors;
  }

  /** True if setting `roleId`'s parent to `proposedParentId` would create a
   * cycle — either directly (self-parenting) or transitively (proposedParentId
   * is already a descendant of roleId). Checked before every parent change. */
  async wouldCreateCycle(roleId: string, proposedParentId: string): Promise<boolean> {
    if (roleId === proposedParentId) {
      return true;
    }
    const chain = await this.getAncestorChain(proposedParentId);
    return chain.some((role) => role._id.toString() === roleId);
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
    return Role.findByIdAndUpdate(id, input, { new: true, runValidators: true })
      .populate('permissions')
      .populate('parentRole', 'name')
      .exec();
  }

  async deleteById(id: string | Types.ObjectId): Promise<RoleDocument | null> {
    const deleted = await Role.findByIdAndDelete(id).exec();
    if (deleted) {
      await User.updateMany({ roles: deleted._id }, { $pull: { roles: deleted._id } }).exec();
      // Cascade like every other Role/Permission delete — a child left
      // pointing at a now-nonexistent parentRole would silently lose its
      // inherited permissions the next time anyone resolves the hierarchy.
      await Role.updateMany({ parentRole: deleted._id }, { parentRole: null }).exec();
    }
    return deleted;
  }
}
