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
  findByName(tenantId: string | Types.ObjectId, name: string): Promise<RoleDocument | null> {
    return Role.findOne({ tenantId, name: name.toLowerCase() }).exec();
  }

  findById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    populatePermissions = false,
  ): Promise<RoleDocument | null> {
    const query = Role.findOne({ _id: id, tenantId });
    if (populatePermissions) {
      query.populate('permissions').populate('parentRole', 'name');
    }
    return query.exec();
  }

  create(tenantId: string | Types.ObjectId, input: CreateRoleInput): Promise<RoleDocument> {
    return Role.create({ ...input, tenantId });
  }

  /**
   * Walks parentRole → parentRole → ... starting from (but not including)
   * `roleId`, each ancestor populated with its own permissions, so callers
   * can flatten a role's *effective* (own + inherited) permission set.
   * `maxDepth` is a defensive cap (real hierarchies should be a handful of
   * levels at most) — combined with `seen`, also guards against a cycle
   * that somehow got persisted despite create/update-time prevention.
   * Scoped by tenantId even though a parentRole can never legitimately point
   * outside its own tenant — defense in depth, not a case this should ever
   * actually hit.
   */
  async getAncestorChain(
    tenantId: string | Types.ObjectId,
    roleId: string | Types.ObjectId,
    maxDepth = 20,
  ): Promise<RoleDocument[]> {
    const ancestors: RoleDocument[] = [];
    const seen = new Set<string>([roleId.toString()]);

    const start = await Role.findOne({ _id: roleId, tenantId }).select('parentRole').exec();
    let currentId = start?.parentRole ?? null;

    while (currentId && ancestors.length < maxDepth) {
      const idStr = currentId.toString();
      if (seen.has(idStr)) break;
      seen.add(idStr);

      const ancestor = await Role.findOne({ _id: currentId, tenantId }).populate('permissions').exec();
      if (!ancestor) break;
      ancestors.push(ancestor);
      currentId = ancestor.parentRole;
    }

    return ancestors;
  }

  /** True if setting `roleId`'s parent to `proposedParentId` would create a
   * cycle — either directly (self-parenting) or transitively (proposedParentId
   * is already a descendant of roleId). Checked before every parent change. */
  async wouldCreateCycle(
    tenantId: string | Types.ObjectId,
    roleId: string,
    proposedParentId: string,
  ): Promise<boolean> {
    if (roleId === proposedParentId) {
      return true;
    }
    const chain = await this.getAncestorChain(tenantId, proposedParentId);
    return chain.some((role) => role._id.toString() === roleId);
  }

  async list(
    tenantId: string | Types.ObjectId,
    filter: ListRolesFilter,
    pagination: PaginationParams,
  ): Promise<{ items: RoleDocument[]; total: number }> {
    const query: Record<string, unknown> = { tenantId };
    if (filter.search) {
      query.name = { $regex: filter.search, $options: 'i' };
    }
    const [items, total] = await Promise.all([
      Role.find(query).sort({ name: 1 }).skip(pagination.skip).limit(pagination.limit).exec(),
      Role.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  updateById(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    input: UpdateRoleInput,
  ): Promise<RoleDocument | null> {
    return Role.findOneAndUpdate({ _id: id, tenantId }, input, { new: true, runValidators: true })
      .populate('permissions')
      .populate('parentRole', 'name')
      .exec();
  }

  async deleteById(tenantId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<RoleDocument | null> {
    const deleted = await Role.findOneAndDelete({ _id: id, tenantId }).exec();
    if (deleted) {
      await User.updateMany({ tenantId, roles: deleted._id }, { $pull: { roles: deleted._id } }).exec();
      // Cascade like every other Role/Permission delete — a child left
      // pointing at a now-nonexistent parentRole would silently lose its
      // inherited permissions the next time anyone resolves the hierarchy.
      await Role.updateMany({ tenantId, parentRole: deleted._id }, { parentRole: null }).exec();
    }
    return deleted;
  }
}
