import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export function NotFoundPage() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const homePath = status === 'authenticated' ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <p className="text-5xl font-bold text-gray-300" aria-hidden="true">
        404
      </p>
      <h1 className="text-xl font-semibold text-gray-900">{t('errors.notFoundTitle')}</h1>
      <p className="max-w-sm text-sm text-gray-600">{t('errors.notFoundBody')}</p>
      <Link to={homePath} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        {t('errors.backToSafety')}
      </Link>
    </div>
  );
}
