export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiItemResponse<T> {
  data: T;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `permissions` is a plain id array on list views (backend doesn't populate
 * for performance) and an array of full Permission objects on the detail
 * view (GET /roles/:id). Narrow with `isPopulatedPermissions` before reading
 * `.name` off an entry.
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[] | string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: Role[] | string[];
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export function isPopulatedPermissions(permissions: Permission[] | string[]): permissions is Permission[] {
  return permissions.length === 0 || typeof permissions[0] !== 'string';
}

export function isPopulatedRoles(roles: Role[] | string[]): roles is Role[] {
  return roles.length === 0 || typeof roles[0] !== 'string';
}

export const AUDIT_ACTIONS = [
  'auth.register',
  'auth.login.success',
  'auth.login.failure',
  'auth.refresh',
  'auth.refresh.reuse_detected',
  'auth.logout',
  'permission.create',
  'permission.update',
  'permission.delete',
  'role.create',
  'role.update',
  'role.delete',
  'user.update',
  'user.delete',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogEntry {
  id: string;
  userId: { id: string; name: string; email: string } | null;
  action: AuditAction;
  ip: string | null;
  userAgent: string | null;
  // Omitted from storage entirely (not `{}`) when nothing was passed at
  // creation time — Mongoose's `minimize` option strips empty Mixed fields.
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
