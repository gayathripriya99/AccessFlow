import { CreateRoleInput, ListRolesFilter, RoleRepository, UpdateRoleInput } from '../repositories/RoleRepository';
import { PermissionRepository } from '../repositories/PermissionRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { ApiError } from '../utils/ApiError';
import { PaginationMeta, PaginationParams, buildPaginationMeta } from '../utils/pagination';
import { toObjectIdArray } from '../utils/objectId';
import { RequestContext } from './AuthService';
import { RoleDocument } from '../models/Role';
import { CreateRoleBody, UpdateRoleBody } from '../validators/role.validators';

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

    const createInput: CreateRoleInput = {
      name: input.name,
      description: input.description,
      permissions: toObjectIdArray(input.permissions ?? []),
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

  async getById(id: string): Promise<RoleDocument> {
    const role = await this.roleRepository.findById(id, true);
    if (!role) {
      throw ApiError.notFound('Role not found');
    }
    return role;
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

    const updateInput: UpdateRoleInput = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.permissions ? { permissions: toObjectIdArray(input.permissions) } : {}),
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
}
