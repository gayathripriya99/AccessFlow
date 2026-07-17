import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Forbidden() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 p-8 text-center"
      role="alert"
    >
      <h1 className="text-lg font-semibold text-red-800">{t('errors.forbiddenTitle')}</h1>
      <p className="text-sm text-red-700">{t('errors.forbidden')}</p>
      <Link to="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        {t('errors.backToSafety')}
      </Link>
    </div>
  );
}
