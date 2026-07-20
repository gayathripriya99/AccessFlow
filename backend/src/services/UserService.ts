import { ListUsersFilter, UpdateUserInput, UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { AuthorizationService } from './AuthorizationService';
import { ApiError } from '../utils/ApiError';
import { PaginationMeta, PaginationParams, buildPaginationMeta } from '../utils/pagination';
import { toObjectIdArray } from '../utils/objectId';
import { RequestContext } from './AuthService';
import { UserDocument } from '../models/User';
import { UpdateUserBody } from '../validators/user.validators';

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(
    filter: ListUsersFilter,
    pagination: PaginationParams,
  ): Promise<{ items: UserDocument[]; meta: PaginationMeta }> {
    const { items, total } = await this.userRepository.list(filter, pagination);
    return { items, meta: buildPaginationMeta(pagination, total) };
  }

  async getById(id: string): Promise<UserDocument> {
    const user = await this.userRepository.findById(id, true);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return user;
  }

  async update(id: string, input: UpdateUserBody, context: RequestContext): Promise<UserDocument> {
    // Phase 8: a caller reaching this via the ABAC self-service-update policy
    // (not a real users.update grant) may only ever touch their own `name` —
    // otherwise "update your own profile" would double as "grant yourself
    // any role you like," which defeats the entire permission system. Real
    // admins (who do hold users.update) are unaffected by this check.
    if (context.actorId === id && (input.roles !== undefined || input.isActive !== undefined)) {
      const actorPermissions = await this.authorizationService.getPermissionNames(context.actorId);
      if (!actorPermissions.has('users.update')) {
        throw ApiError.forbidden('Self-service profile updates may only change your name, not roles or active status');
      }
    }

    if (input.roles) {
      await this.assertRolesExist(input.roles);
    }

    const updateInput: UpdateUserInput = {
      ...(input.name ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.roles ? { roles: toObjectIdArray(input.roles) } : {}),
    };

    const updated = await this.userRepository.updateById(id, updateInput);
    if (!updated) {
      throw ApiError.notFound('User not found');
    }

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'user.update',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { targetUserId: id, changes: input },
    });
    return updated;
  }

  async delete(id: string, context: RequestContext): Promise<void> {
    const deleted = await this.userRepository.deleteById(id);
    if (!deleted) {
      throw ApiError.notFound('User not found');
    }
    await this.refreshTokenRepository.revokeAllForUser(deleted._id);

    await this.auditLogRepository.record({
      userId: context.actorId,
      action: 'user.delete',
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { targetUserId: id, email: deleted.email },
    });
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    const results = await Promise.all(roleIds.map((id) => this.roleRepository.findById(id)));
    const missingIndex = results.findIndex((role) => !role);
    if (missingIndex !== -1) {
      throw ApiError.badRequest(`Unknown role id: ${roleIds[missingIndex]}`);
    }
  }
}
