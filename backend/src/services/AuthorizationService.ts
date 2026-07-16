import { UserRepository } from '../repositories/UserRepository';
import { RoleDocument } from '../models/Role';
import { PermissionDocument } from '../models/Permission';

export class AuthorizationService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Resolves the effective permission-name set for a user by flattening
   * every permission across every role they hold. Deactivated or
   * since-deleted users resolve to an empty set — this doubles as a check
   * that the caller's account is still valid, since access JWTs are
   * stateless and requireAuth alone can't see DB-side deactivation/deletion.
   */
  async getPermissionNames(userId: string): Promise<Set<string>> {
    const user = await this.userRepository.findByIdWithPermissions(userId);
    if (!user || !user.isActive) {
      return new Set();
    }

    const permissionNames = new Set<string>();
    const roles = user.roles as unknown as RoleDocument[];
    for (const role of roles) {
      const permissions = role.permissions as unknown as PermissionDocument[];
      for (const permission of permissions) {
        permissionNames.add(permission.name);
      }
    }
    return permissionNames;
  }
}
