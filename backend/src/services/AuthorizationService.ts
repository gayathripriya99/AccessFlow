import { Types } from 'mongoose';
import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { RoleDocument } from '../models/Role';
import { PermissionDocument } from '../models/Permission';

export interface ResolvedAccess {
  roleNames: string[];
  permissionNames: Set<string>;
}

const EMPTY_ACCESS: ResolvedAccess = { roleNames: [], permissionNames: new Set() };

export class AuthorizationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Resolves a user's roles and their flattened, deduplicated permission
   * names — including permissions inherited from each role's ancestor chain
   * (Phase 7's role hierarchy), not just each role's own directly-assigned
   * permissions. Deactivated or since-deleted users resolve to empty access
   * — this doubles as a check that the caller's account is still valid,
   * since access JWTs are stateless and requireAuth alone can't see DB-side
   * deactivation/deletion.
   */
  async resolveAccess(tenantId: string | Types.ObjectId, userId: string): Promise<ResolvedAccess> {
    const user = await this.userRepository.findByIdWithPermissions(tenantId, userId);
    if (!user || !user.isActive) {
      return EMPTY_ACCESS;
    }

    const roles = user.roles as unknown as RoleDocument[];
    const roleNames = roles.map((role) => role.name);
    const permissionNames = new Set<string>();
    for (const role of roles) {
      const permissions = role.permissions as unknown as PermissionDocument[];
      for (const permission of permissions) {
        permissionNames.add(permission.name);
      }

      const ancestors = await this.roleRepository.getAncestorChain(tenantId, role._id);
      for (const ancestor of ancestors) {
        const ancestorPermissions = ancestor.permissions as unknown as PermissionDocument[];
        for (const permission of ancestorPermissions) {
          permissionNames.add(permission.name);
        }
      }
    }

    return { roleNames, permissionNames };
  }

  async getPermissionNames(tenantId: string | Types.ObjectId, userId: string): Promise<Set<string>> {
    return (await this.resolveAccess(tenantId, userId)).permissionNames;
  }
}
