import { Types } from 'mongoose';
import { CreateRoleInput, ListRolesFilter, RoleRepository, UpdateRoleInput } from '../repositories/RoleRepository';
import { PermissionRepository } from '../repositories/PermissionRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { ApiError } from '../utils/ApiError';
import { PaginationMeta, PaginationParams, buildPaginationMeta } from '../utils/pagination';
import { toObjectIdArray } from '../utils/objectId';
import { RequestContext } from './AuthService';
import { RoleDocument } from '../models/Role';
import { PermissionDocument } from '../models/Permission';
import { CreateRoleBody, UpdateRoleBody } from '../validators/role.validators';

export interface RoleDetail {
  effectivePermissions: string[];
  ancestorNames: string[];
  [key: string]: unknown;
}

export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async create(input: CreateRoleBody, context: RequestContext): Promise<RoleDocument> {
    const existing = await this.roleRepository.findByName(input.name);
    if (existing) {
      throw ApiError.conflict('A role with this name already exists');
    }

    await this.assertPermissionsExist(input.permissions ?? []);
    // A brand-new role has no children yet, so a parent assigned at create
    // time can never introduce a cycle — only existence needs checking.
    const parentRole = await this.resolveParent(null, input.parentRoleId);

    const createInput: CreateRoleInput = {
      name: input.name,
      description: input.description,
      permissions: toObjectIdArray(input.permissions ?? []),
      parentRole,
    };
    const role = await this.roleRepository.create(createInput);

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'role.create',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { roleId: role._id.toString(), name: role.name },
    });
    return role;
  }

  async list(
    filter: ListRolesFilter,
    pagination: PaginationParams,
  ): Promise<{ items: RoleDocument[]; meta: PaginationMeta }> {
    const { items, total } = await this.roleRepository.list(filter, pagination);
    return { items, meta: buildPaginationMeta(pagination, total) };
  }

  /** Unlike Permission/User's getById, also resolves the role hierarchy:
   * `effectivePermissions` is this role's own permissions unioned with every
   * ancestor's, and `ancestorNames` is the chain from immediate parent to
   * root — both purely additive to the existing response shape. */
  async getById(id: string): Promise<RoleDetail> {
    const role = await this.roleRepository.findById(id, true);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    const ancestors = await this.roleRepository.getAncestorChain(id);
    const effectivePermissions = new Set<string>();
    for (const permission of role.permissions as unknown as PermissionDocument[]) {
      effectivePermissions.add(permission.name);
    }
    for (const ancestor of ancestors) {
      for (const permission of ancestor.permissions as unknown as PermissionDocument[]) {
        effectivePermissions.add(permission.name);
      }
    }

    return {
      ...role.toJSON(),
      effectivePermissions: [...effectivePermissions].sort(),
      ancestorNames: ancestors.map((ancestor) => ancestor.name),
    };
  }

  async update(id: string, input: UpdateRoleBody, context: RequestContext): Promise<RoleDocument> {
    if (input.name) {
      const existing = await this.roleRepository.findByName(input.name);
      if (existing && existing._id.toString() !== id) {
        throw ApiError.conflict('A role with this name already exists');
      }
    }

    if (input.permissions) {
      await this.assertPermissionsExist(input.permissions);
    }

    const parentRole = await this.resolveParent(id, input.parentRoleId);

    const updateInput: UpdateRoleInput = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.permissions ? { permissions: toObjectIdArray(input.permissions) } : {}),
      ...(parentRole !== undefined ? { parentRole } : {}),
    };

    const updated = await this.roleRepository.updateById(id, updateInput);
    if (!updated) {
      throw ApiError.notFound('Role not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'role.update',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { roleId: id, changes: input },
    });
    return updated;
  }

  async delete(id: string, context: RequestContext): Promise<void> {
    const deleted = await this.roleRepository.deleteById(id);
    if (!deleted) {
      throw ApiError.notFound('Role not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'role.delete',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { roleId: id, name: deleted.name },
    });
  }

  private async assertPermissionsExist(permissionIds: string[]): Promise<void> {
    const results = await Promise.all(permissionIds.map((id) => this.permissionRepository.findById(id)));
    const missingIndex = results.findIndex((permission) => !permission);
    if (missingIndex !== -1) {
      throw ApiError.badRequest(`Unknown permission id: ${permissionIds[missingIndex]}`);
    }
  }

  /** `undefined` = parent not being changed; `null` = explicitly clearing it;
   * a string = set to that role (existence + cycle-checked). `roleId` is
   * `null` for a create (nothing can be its own ancestor yet). */
  private async resolveParent(
    roleId: string | null,
    parentRoleId: string | null | undefined,
  ): Promise<Types.ObjectId | null | undefined> {
    if (parentRoleId === undefined) {
      return undefined;
    }
    if (parentRoleId === null) {
      return null;
    }

    const parent = await this.roleRepository.findById(parentRoleId);
    if (!parent) {
      throw ApiError.badRequest(`Unknown parent role id: ${parentRoleId}`);
    }

    if (roleId !== null) {
      const cycle = await this.roleRepository.wouldCreateCycle(roleId, parentRoleId);
      if (cycle) {
        throw ApiError.badRequest('Setting this parent would create a role hierarchy cycle');
      }
    }

    return new Types.ObjectId(parentRoleId);
  }
}
