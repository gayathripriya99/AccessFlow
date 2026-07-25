import { Types } from 'mongoose';
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

  async create(
    tenantId: string | Types.ObjectId,
    input: CreatePermissionInput,
    context: RequestContext,
  ): Promise<PermissionDocument> {
    const existing = await this.permissionRepository.findByName(tenantId, input.name);
    if (existing) {
      throw ApiError.conflict('A permission with this name already exists');
    }

    const permission = await this.permissionRepository.create(tenantId, input);
    await this.auditLogRepository.record(tenantId, {
      userId: context.actorId,
      action: 'permission.create',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { permissionId: permission._id.toString(), name: permission.name },
    });
    return permission;
  }

  async list(
    tenantId: string | Types.ObjectId,
    filter: ListPermissionsFilter,
    pagination: PaginationParams,
  ): Promise<{ items: PermissionDocument[]; meta: PaginationMeta }> {
    const { items, total } = await this.permissionRepository.list(tenantId, filter, pagination);
    return { items, meta: buildPaginationMeta(pagination, total) };
  }

  async getById(tenantId: string | Types.ObjectId, id: string): Promise<PermissionDocument> {
    const permission = await this.permissionRepository.findById(tenantId, id);
    if (!permission) {
      throw ApiError.notFound('Permission not found');
    }
    return permission;
  }

  async update(
    tenantId: string | Types.ObjectId,
    id: string,
    input: UpdatePermissionInput,
    context: RequestContext,
  ): Promise<PermissionDocument> {
    if (input.name) {
      const existing = await this.permissionRepository.findByName(tenantId, input.name);
      if (existing && existing._id.toString() !== id) {
        throw ApiError.conflict('A permission with this name already exists');
      }
    }

    const updated = await this.permissionRepository.updateById(tenantId, id, input);
    if (!updated) {
      throw ApiError.notFound('Permission not found');
    }

    await this.auditLogRepository.record(tenantId, {
      userId: context.actorId,
      action: 'permission.update',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { permissionId: id, changes: input },
    });
    return updated;
  }

  async delete(tenantId: string | Types.ObjectId, id: string, context: RequestContext): Promise<void> {
    const deleted = await this.permissionRepository.deleteById(tenantId, id);
    if (!deleted) {
      throw ApiError.notFound('Permission not found');
    }

    await this.auditLogRepository.record(tenantId, {
      userId: context.actorId,
      action: 'permission.delete',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { permissionId: id, name: deleted.name },
    });
  }
}
