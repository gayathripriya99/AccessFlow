import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRole, deleteRole, getRole, listRoles, updateRole } from '../api/roles';
import type { UpdateRoleInput } from '../api/roles';
import { listPermissions } from '../api/permissions';
import { isPopulatedPermissions } from '../api/types';
import type { Role } from '../api/types';
import { getErrorMessage } from '../api/errors';
import { validateNameDescription } from '../auth/validators';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PermissionGate } from '../auth/PermissionGate';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { SearchInput } from '../components/SearchInput';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';

interface FormState {
  name: string;
  description: string;
  permissions: string[];
  parentRoleId: string;
}

const EMPTY_FORM: FormState = { name: '', description: '', permissions: [], parentRoleId: '' };

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
  const [fieldErrors, setFieldErrors] = useState<{ name: boolean; description: boolean } | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['roles', page, debouncedSearch],
    queryFn: () => listRoles({ page, limit: 10, search: debouncedSearch || undefined }),
  });

  const formOpen = creating || editingId !== null;

  const { data: allPermissions } = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => listPermissions({ page: 1, limit: 100 }),
    enabled: formOpen,
  });

  // Parent-role picker needs every role regardless of this page's own
  // search/pagination — a role hierarchy is a separate concern from the list view.
  const { data: allRoles } = useQuery({
    queryKey: ['roles', 'all'],
    queryFn: () => listRoles({ page: 1, limit: 100 }),
    enabled: formOpen,
  });

  // List rows don't carry parentRole/effectivePermissions/ancestorNames (see
  // Role's doc comment) — fetch the detail view when editing to get them.
  const { data: editingDetail } = useQuery({
    queryKey: ['roles', 'detail', editingId],
    queryFn: () => getRole(editingId!),
    enabled: editingId !== null,
  });

  useEffect(() => {
    if (editingDetail) {
      setForm((prev) => ({ ...prev, parentRoleId: editingDetail.parentRole?.id ?? '' }));
    }
  }, [editingDetail]);

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
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) => updateRole(id, input),
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
    setFieldErrors(null);
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(role: Role) {
    const permissionIds = isPopulatedPermissions(role.permissions)
      ? role.permissions.map((permission) => permission.id)
      : role.permissions;
    // parentRoleId starts empty and is filled in by the editingDetail effect
    // once the detail fetch resolves (list rows don't carry it).
    setForm({ name: role.name, description: role.description, permissions: permissionIds, parentRoleId: '' });
    setFormError(null);
    setFieldErrors(null);
    setCreating(false);
    setEditingId(role.id);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFieldErrors(null);
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
    const errors = validateNameDescription(form);
    setFieldErrors(errors);
    if (errors) {
      return;
    }
    // Empty-string "no parent selected" must become null, not '' — the
    // backend's parentRoleId is either a real ObjectId string or null.
    const payload = { ...form, parentRoleId: form.parentRoleId || null };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: payload });
    } else {
      createMutation.mutate(payload);
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
          noValidate
          className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {editingId ? t('roles.editRole') : t('roles.createRole')}
          </h2>
          <FormField
            label={t('common.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={fieldErrors?.name ? t('common.fieldRequired') : undefined}
          />
          <FormField
            label={t('common.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            error={fieldErrors?.description ? t('common.fieldRequired') : undefined}
          />
          <FormField label={t('roles.parentRole')} id="role-parent">
            <select
              id="role-parent"
              value={form.parentRoleId}
              onChange={(e) => setForm({ ...form, parentRoleId: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="">{t('roles.noParent')}</option>
              {allRoles?.data
                .filter((role) => role.id !== editingId)
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
            </select>
          </FormField>

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

          {editingDetail && editingDetail.ancestorNames && editingDetail.ancestorNames.length > 0 && (
            <p className="text-sm text-gray-600">
              {t('roles.inheritsFrom')} {editingDetail.ancestorNames.join(' ← ')}
            </p>
          )}
          {editingDetail?.effectivePermissions && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-900">{t('roles.effectivePermissions')}</h3>
              <ul className="flex flex-wrap gap-2">
                {editingDetail.effectivePermissions.map((name) => (
                  <li key={name} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
