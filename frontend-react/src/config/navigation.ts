export interface NavItem {
  key: string;
  path: string;
  labelKey: string;
  permission?: string;
}

/** Single source of truth for the app's primary navigation — Sidebar (desktop) and Navbar's mobile drawer both render from this list, filtered by the caller's permissions, instead of hand-duplicating links in two places. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'users', path: '/users', labelKey: 'nav.users', permission: 'users.read' },
  { key: 'roles', path: '/roles', labelKey: 'nav.roles', permission: 'roles.read' },
  { key: 'permissions', path: '/permissions', labelKey: 'nav.permissions', permission: 'permissions.read' },
];
