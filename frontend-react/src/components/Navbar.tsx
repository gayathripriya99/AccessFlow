import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './Button';
import { NAV_ITEMS } from '../config/navigation';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
  }`;

/** Top bar: app title + always-visible language/logout, plus a mobile-only (below xl) drawer of NAV_ITEMS — desktop navigation lives in Sidebar instead, so links aren't duplicated across two components. */
export function Navbar() {
  const { t } = useTranslation();
  const { currentUser, hasPermission, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation — otherwise it stays open over the new page after tapping a link.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 xl:px-6">
        <span className="text-lg font-semibold text-gray-900">AccessFlow</span>

        <button
          type="button"
          className="rounded-md p-1 text-xl xl:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={t('nav.toggleMenu')}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
        </button>

        <div className="hidden items-center gap-3 xl:flex">
          {currentUser && <span className="text-sm text-gray-600">{currentUser.name}</span>}
          <LanguageSwitcher />
          <Button variant="secondary" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 xl:hidden">
          {visibleItems.map((item) => (
            <NavLink key={item.key} to={item.path} className={linkClasses}>
              {t(item.labelKey)}
            </NavLink>
          ))}
          <LanguageSwitcher />
          <Button variant="secondary" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
        </div>
      )}
    </nav>
  );
}
