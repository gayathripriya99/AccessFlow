import { useTranslation } from 'react-i18next';

export function Forbidden() {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
      {t('errors.forbidden')}
    </div>
  );
}
