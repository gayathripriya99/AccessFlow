import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { ApiError } from '../utils/ApiError';
import { RoleDocument } from '../models/Role';
import { PermissionDocument } from '../models/Permission';

export interface SimulationResult {
  allowed: boolean;
  permission: string;
  roleNames: string[];
  grantedByRoles: string[];
  resolvedPermissions: string[];
  /** Only present for user-mode simulations — a deactivated user's effective
   * access is always zero (mirrors AuthorizationService.resolveAccess), even
   * though their role assignments are still shown for diagnostic purposes. */
  userActive?: boolean;
}

export class SimulatorService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  async simulateForUser(userId: string, permission: string): Promise<SimulationResult> {
    const user = await this.userRepository.findByIdWithPermissions(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    const roles = user.roles as unknown as RoleDocument[];
    const result = await this.resolve(roles, permission);
    return { ...result, userActive: user.isActive, allowed: user.isActive && result.allowed };
  }

  async simulateForRoles(roleIds: string[], permission: string): Promise<SimulationResult> {
    const roles = await Promise.all(roleIds.map((id) => this.roleRepository.findById(id, true)));
    const missingIndex = roles.findIndex((role) => !role);
    if (missingIndex !== -1) {
      throw ApiError.badRequest(`Unknown role id: ${roleIds[missingIndex]}`);
    }
    return this.resolve(roles as RoleDocument[], permission);
  }

  /** A role "grants" the checked permission if it does so directly or via
   * its ancestor chain (Phase 7 role hierarchy) — from the caller's point of
   * view "I have role X, therefore I can do Y" holds regardless of whether X
   * or one of X's ancestors is the one that actually carries the permission,
   * so each role is resolved to its full own+inherited set before checking. */
  private async resolve(roles: RoleDocument[], permission: string): Promise<SimulationResult> {
    const roleNames = roles.map((role) => role.name);
    const grantedByRoles: string[] = [];
    const resolvedPermissions = new Set<string>();

    for (const role of roles) {
      const ownNames = (role.permissions as unknown as PermissionDocument[]).map((p) => p.name);
      const ancestors = await this.roleRepository.getAncestorChain(role._id);
      const inheritedNames = ancestors.flatMap((ancestor) =>
        (ancestor.permissions as unknown as PermissionDocument[]).map((p) => p.name),
      );

      const roleEffectiveNames = new Set([...ownNames, ...inheritedNames]);
      roleEffectiveNames.forEach((name) => resolvedPermissions.add(name));
      if (roleEffectiveNames.has(permission)) {
        grantedByRoles.push(role.name);
      }
    }

    return {
      allowed: grantedByRoles.length > 0,
      permission,
      roleNames,
      grantedByRoles,
      resolvedPermissions: [...resolvedPermissions].sort(),
    };
  }
}
