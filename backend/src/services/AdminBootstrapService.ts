import { Types } from 'mongoose';
import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { PermissionRepository } from '../repositories/PermissionRepository';
import { ADMIN_ROLE_NAME, SYSTEM_PERMISSIONS } from '../constants/systemPermissions';
import { UserDocument } from '../models/User';
import { logger } from '../config/logger';

export class AdminBootstrapService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
  ) {}

  /**
   * Called right after a user is created. If this user turns out to be the
   * only one in the system, grants them a fully-permissioned `admin` role so
   * an empty deployment isn't locked out of managing its own permissions/roles.
   * Idempotent: safe to call even if the baseline permissions/role already exist.
   */
  async bootstrapFirstUserAsAdmin(user: UserDocument): Promise<void> {
    const totalUsers = await this.userRepository.count();
    if (totalUsers !== 1) {
      return;
    }

    const permissionIds: Types.ObjectId[] = [];
    for (const definition of SYSTEM_PERMISSIONS) {
      const existing = await this.permissionRepository.findByName(definition.name);
      const permission = existing ?? (await this.permissionRepository.create(definition));
      permissionIds.push(permission._id);
    }

    const existingRole = await this.roleRepository.findByName(ADMIN_ROLE_NAME);
    const adminRole =
      existingRole ??
      (await this.roleRepository.create({
        name: ADMIN_ROLE_NAME,
        description: 'Full access to manage users, roles, and permissions',
        permissions: permissionIds,
      }));

    await this.userRepository.updateById(user._id, { roles: [adminRole._id] });

    logger.info({ userId: user._id.toString(), email: user.email }, 'First user bootstrapped as admin');
  }
}
