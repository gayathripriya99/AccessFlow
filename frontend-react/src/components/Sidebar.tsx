import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { NAV_ITEMS } from '../config/navigation';

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
  }`;

/** Desktop-only (xl+) left sidebar. Menu items are generated from NAV_ITEMS and filtered by the caller's resolved permissions — never a hardcoded role check (CLAUDE.md RBAC rule). Role names are shown for context only, not used for any access decision. */
export function Sidebar() {
  const { t } = useTranslation();
  const { currentUser, hasPermission } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <aside className="hidden xl:flex xl:w-56 xl:shrink-0 xl:flex-col xl:border-r xl:border-gray-200 xl:bg-white">
      <div className="flex h-full flex-col gap-6 px-3 py-6">
        <nav aria-label={t('nav.mainNavigation')} className="flex flex-col gap-1">
          {visibleItems.map((item) => (
            <NavLink key={item.key} to={item.path} className={linkClasses}>
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {currentUser && (
          <div className="mt-auto rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="truncate text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="truncate text-xs text-gray-500">{currentUser.email}</p>
            {currentUser.roles.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {currentUser.roles.map((role) => (
                  <li key={role} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                    {role}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
