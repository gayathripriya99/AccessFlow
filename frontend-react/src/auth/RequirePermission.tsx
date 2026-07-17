import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Forbidden } from '../components/Forbidden';

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
}

/** Route-level guard: renders Forbidden instead of the page when the caller lacks the permission, so direct URL navigation can't bypass what the Navbar already hides via PermissionGate. */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? <>{children}</> : <Forbidden />;
}
