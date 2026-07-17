import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPermission,
  deletePermission,
  listPermissions,
  updatePermission,
} from '../api/permissions';
import type { Permission } from '../api/types';
import { getErrorMessage } from '../api/errors';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PermissionGate } from '../auth/PermissionGate';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { SearchInput } from '../components/SearchInput';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';

interface FormState {
  name: string;
  description: string;
}

const EMPTY_FORM: FormState = { name: '', description: '' };

export function PermissionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['permissions', page, debouncedSearch],
    queryFn: () => listPermissions({ page, limit: 10, search: debouncedSearch || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['permissions'] });

  const createMutation = useMutation({
    mutationFn: createPermission,
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FormState }) => updatePermission(id, input),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePermission,
    onSuccess: invalidate,
  });

  function startCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(permission: Permission) {
    setForm({ name: permission.name, description: permission.description });
    setFormError(null);
    setCreating(false);
    setEditingId(permission.id);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function onDelete(permission: Permission) {
    if (window.confirm(t('permissions.deleteConfirm'))) {
      deleteMutation.mutate(permission.id);
    }
  }

  const columns: Column<Permission>[] = [
    { key: 'name', header: t('common.name'), render: (row) => row.name },
    { key: 'description', header: t('common.description'), render: (row) => row.description },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-2">
          <PermissionGate permission="permissions.update">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t('common.edit')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="permissions.delete">
            <Button variant="danger" onClick={() => onDelete(row)}>
              {t('common.delete')}
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const formOpen = creating || editingId !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('permissions.title')}</h1>
        <PermissionGate permission="permissions.create">
          <Button onClick={startCreate}>{t('permissions.createPermission')}</Button>
        </PermissionGate>
      </div>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('permissions.searchPlaceholder')}
      />

      {formOpen && (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {editingId ? t('permissions.editPermission') : t('permissions.createPermission')}
          </h2>
          <FormField
            label={t('common.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <FormField
            label={t('common.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
          {formError && (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {t('common.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p role="status">{t('common.loading')}</p>
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
