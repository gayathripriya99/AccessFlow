export const ADMIN_ROLE_NAME = 'admin';

export interface SystemPermissionDefinition {
  name: string;
  description: string;
}

/**
 * Baseline permission set auto-created the moment the very first user ever
 * registers (see AdminBootstrapService). No `users.create` — user creation
 * stays at the unguarded /auth/register, there's no POST /users route.
 */
export const SYSTEM_PERMISSIONS: SystemPermissionDefinition[] = [
  { name: 'permissions.create', description: 'Create permissions' },
  { name: 'permissions.read', description: 'View permissions' },
  { name: 'permissions.update', description: 'Update permissions' },
  { name: 'permissions.delete', description: 'Delete permissions' },
  { name: 'roles.create', description: 'Create roles' },
  { name: 'roles.read', description: 'View roles' },
  { name: 'roles.update', description: 'Update roles' },
  { name: 'roles.delete', description: 'Delete roles' },
  { name: 'users.read', description: 'View users' },
  { name: 'users.update', description: 'Update users' },
  { name: 'users.delete', description: 'Delete users' },
  { name: 'auditlogs.read', description: 'View audit logs' },
  { name: 'simulator.run', description: 'Run the permission simulator' },
  { name: 'policies.create', description: 'Create ABAC policies' },
  { name: 'policies.read', description: 'View ABAC policies' },
  { name: 'policies.update', description: 'Update ABAC policies' },
  { name: 'policies.delete', description: 'Delete ABAC policies' },
];
