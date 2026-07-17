import { useTranslation } from 'react-i18next';
import type { PaginationMeta } from '../api/types';
import { Button } from './Button';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <Button
        variant="secondary"
        disabled={meta.page <= 1}
        onClick={() => onPageChange(meta.page - 1)}
      >
        {t('common.back')}
      </Button>
      <span className="text-sm text-gray-600">
        {t('common.page')} {meta.page} {t('common.of')} {meta.totalPages}
      </span>
      <Button
        variant="secondary"
        disabled={meta.page >= meta.totalPages}
        onClick={() => onPageChange(meta.page + 1)}
      >
        →
      </Button>
    </div>
  );
}
