import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRole, deleteRole, listRoles, updateRole } from '../api/roles';
import { listPermissions } from '../api/permissions';
import { isPopulatedPermissions } from '../api/types';
import type { Role } from '../api/types';
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
  permissions: string[];
}

const EMPTY_FORM: FormState = { name: '', description: '', permissions: [] };

export function RolesPage() {
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
    queryKey: ['roles', page, debouncedSearch],
    queryFn: () => listRoles({ page, limit: 10, search: debouncedSearch || undefined }),
  });

  const formOpen = creating || editingId !== null;

  const { data: allPermissions } = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => listPermissions({ page: 1, limit: 100 }),
    enabled: formOpen,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['roles'] });

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FormState }) => updateRole(id, input),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: invalidate,
  });

  function startCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(role: Role) {
    const permissionIds = isPopulatedPermissions(role.permissions)
      ? role.permissions.map((permission) => permission.id)
      : role.permissions;
    setForm({ name: role.name, description: role.description, permissions: permissionIds });
    setFormError(null);
    setCreating(false);
    setEditingId(role.id);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function togglePermission(id: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter((p) => p !== id)
        : [...prev.permissions, id],
    }));
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

  function onDelete(role: Role) {
    if (window.confirm(t('roles.deleteConfirm'))) {
      deleteMutation.mutate(role.id);
    }
  }

  const columns: Column<Role>[] = [
    { key: 'name', header: t('common.name'), render: (row) => row.name },
    { key: 'description', header: t('common.description'), render: (row) => row.description },
    { key: 'permissions', header: t('roles.permissions'), render: (row) => row.permissions.length },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-2">
          <PermissionGate permission="roles.update">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t('common.edit')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="roles.delete">
            <Button variant="danger" onClick={() => onDelete(row)}>
              {t('common.delete')}
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('roles.title')}</h1>
        <PermissionGate permission="roles.create">
          <Button onClick={startCreate}>{t('roles.createRole')}</Button>
        </PermissionGate>
      </div>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('roles.searchPlaceholder')}
      />

      {formOpen && (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {editingId ? t('roles.editRole') : t('roles.createRole')}
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
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900">{t('roles.permissions')}</legend>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-gray-200 p-3">
              {allPermissions?.data.map((permission) => (
                <label key={permission.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                  />
                  {permission.name}
                </label>
              ))}
            </div>
          </fieldset>
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
