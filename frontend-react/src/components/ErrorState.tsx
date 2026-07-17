import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../api/errors';
import { Button } from './Button';

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

/** Shown in place of a list when its query fails — used by Users/Roles/PermissionsPage, which otherwise only surfaced errors from mutations, not from the initial fetch. */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 p-6 text-center" role="alert">
      <p className="text-sm text-red-700">{getErrorMessage(error, t)}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
