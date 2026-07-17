import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { PermissionGate } from '../auth/PermissionGate';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './Button';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
  }`;

export function Navbar() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = (
    <>
      <NavLink to="/dashboard" className={linkClasses}>
        {t('nav.dashboard')}
      </NavLink>
      <PermissionGate permission="users.read">
        <NavLink to="/users" className={linkClasses}>
          {t('nav.users')}
        </NavLink>
      </PermissionGate>
      <PermissionGate permission="roles.read">
        <NavLink to="/roles" className={linkClasses}>
          {t('nav.roles')}
        </NavLink>
      </PermissionGate>
      <PermissionGate permission="permissions.read">
        <NavLink to="/permissions" className={linkClasses}>
          {t('nav.permissions')}
        </NavLink>
      </PermissionGate>
    </>
  );

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 xl:px-6">
        <span className="text-lg font-semibold text-gray-900">AccessFlow</span>

        <button
          type="button"
          className="xl:hidden"
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div className="hidden items-center gap-2 xl:flex">
          {links}
          <LanguageSwitcher />
          <Button variant="secondary" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 xl:hidden">
          {links}
          <LanguageSwitcher />
          <Button variant="secondary" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
        </div>
      )}
    </nav>
  );
}
