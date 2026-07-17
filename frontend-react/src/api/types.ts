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

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
