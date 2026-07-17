import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-gray-900">{t('dashboard.welcome', { name: currentUser.name })}</h1>

      {currentUser.roles.length === 0 ? (
        <p className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
          {t('dashboard.noRoles')}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-md border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('dashboard.yourRoles')}</h2>
            <ul className="flex flex-wrap gap-2">
              {currentUser.roles.map((role) => (
                <li key={role} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
                  {role}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('dashboard.yourPermissions')}</h2>
            <ul className="flex flex-wrap gap-2">
              {currentUser.permissions.map((permission) => (
                <li key={permission} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {permission}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
