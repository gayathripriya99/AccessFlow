import {
  CreatePermissionInput,
  ListPermissionsFilter,
  PermissionRepository,
  UpdatePermissionInput,
} from '../repositories/PermissionRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { ApiError } from '../utils/ApiError';
import { PaginationMeta, PaginationParams, buildPaginationMeta } from '../utils/pagination';
import { RequestContext } from './AuthService';
import { PermissionDocument } from '../models/Permission';

export class PermissionService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async create(input: CreatePermissionInput, context: RequestContext): Promise<PermissionDocument> {
    const existing = await this.permissionRepository.findByName(input.name);
    if (existing) {
      throw ApiError.conflict('A permission with this name already exists');
    }

    const permission = await this.permissionRepository.create(input);
    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'permission.create',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { permissionId: permission._id.toString(), name: permission.name },
    });
    return permission;
  }

  async list(
    filter: ListPermissionsFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PermissionDocument[]; meta: PaginationMeta }> {
    const { items, total } = await this.permissionRepository.list(filter, pagination);
    return { items, meta: buildPaginationMeta(pagination, total) };
  }

  async getById(id: string): Promise<PermissionDocument> {
    const permission = await this.permissionRepository.findById(id);
    if (!permission) {
      throw ApiError.notFound('Permission not found');
    }
    return permission;
  }

  async update(id: string, input: UpdatePermissionInput, context: RequestContext): Promise<PermissionDocument> {
    if (input.name) {
      const existing = await this.permissionRepository.findByName(input.name);
      if (existing && existing._id.toString() !== id) {
        throw ApiError.conflict('A permission with this name already exists');
      }
    }

    const updated = await this.permissionRepository.updateById(id, input);
    if (!updated) {
      throw ApiError.notFound('Permission not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'permission.update',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { permissionId: id, changes: input },
    });
    return updated;
  }

  async delete(id: string, context: RequestContext): Promise<void> {
    const deleted = await this.permissionRepository.deleteById(id);
    if (!deleted) {
      throw ApiError.notFound('Permission not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'permission.delete',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { permissionId: id, name: deleted.name },
    });
  }
}
