import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '../api/auditLogs';
import { AUDIT_ACTIONS } from '../api/types';
import type { AuditAction, AuditLogEntry } from '../api/types';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState } from '../components/ErrorState';
import { FormField } from '../components/FormField';

export function AuditLogsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['auditLogs', page, action, from, to],
    queryFn: () =>
      listAuditLogs({
        page,
        limit: 20,
        action: action || undefined,
        from: from || undefined,
        // End-of-day so the "to" date filters through the whole selected day, not just its first instant (UTC midnight).
        to: to ? `${to}T23:59:59.999Z` : undefined,
      }),
  });

  function resetPageAnd<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const setActionFiltered = resetPageAnd(setAction);
  const setFromFiltered = resetPageAnd(setFrom);
  const setToFiltered = resetPageAnd(setTo);

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'createdAt',
      header: t('auditLogs.columns.when'),
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: 'actor',
      header: t('auditLogs.columns.actor'),
      render: (row) => (row.userId ? `${row.userId.name} (${row.userId.email})` : t('auditLogs.systemActor')),
    },
    { key: 'action', header: t('auditLogs.columns.action'), render: (row) => row.action },
    { key: 'ip', header: t('auditLogs.columns.ip'), render: (row) => row.ip ?? '—' },
    {
      key: 'metadata',
      header: t('auditLogs.columns.metadata'),
      render: (row) =>
        // Backend omits an empty `metadata: {}` from storage entirely (Mongoose's
        // `minimize` default), so most entries — anything that didn't pass
        // explicit metadata to AuditLogRepository.record() — arrive with the
        // field absent, not `{}`. Never assume it's present.
        row.metadata && Object.keys(row.metadata).length > 0 ? (
          <span
            className="block max-w-xs truncate text-xs text-gray-500"
            title={JSON.stringify(row.metadata)}
          >
            {JSON.stringify(row.metadata)}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('auditLogs.title')}</h1>

      <div className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 sm:grid-cols-3">
        <FormField label={t('auditLogs.filters.action')} id="audit-action-filter">
          <select
            id="audit-action-filter"
            value={action}
            onChange={(e) => setActionFiltered(e.target.value as AuditAction | '')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          >
            <option value="">{t('auditLogs.filters.allActions')}</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t('auditLogs.filters.from')}
          type="date"
          value={from}
          onChange={(e) => setFromFiltered(e.target.value)}
        />
        <FormField
          label={t('auditLogs.filters.to')}
          type="date"
          value={to}
          onChange={(e) => setToFiltered(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p role="status">{t('common.loading')}</p>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.data ?? []}
            rowKey={(row) => row.id}
            emptyMessage={t('common.noResults')}
          />
          {data && <Pagination meta={data.meta} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}
