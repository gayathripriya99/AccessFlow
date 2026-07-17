import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Conditionally renders children based on the caller's resolved permissions — hides admin actions the user can't use, rather than only relying on a 403 after the fact. */
export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
