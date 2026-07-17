import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteUser, listUsers, updateUser } from '../api/users';
import { listRoles } from '../api/roles';
import { isPopulatedRoles } from '../api/types';
import type { User } from '../api/types';
import { getErrorMessage } from '../api/errors';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PermissionGate } from '../auth/PermissionGate';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { SearchInput } from '../components/SearchInput';
import { Button } from '../components/Button';

interface FormState {
  isActive: boolean;
  roles: string[];
}

export function UsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>({ isActive: true, roles: [] });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: () => listUsers({ page, limit: 10, search: debouncedSearch || undefined }),
  });

  const { data: allRoles } = useQuery({
    queryKey: ['roles', 'all'],
    queryFn: () => listRoles({ page: 1, limit: 100 }),
    enabled: editingUser !== null,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FormState }) => updateUser(id, input),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: invalidate,
  });

  function startEdit(user: User) {
    const roleIds = isPopulatedRoles(user.roles) ? user.roles.map((role) => role.id) : user.roles;
    setForm({ isActive: user.isActive, roles: roleIds });
    setFormError(null);
    setEditingUser(user);
  }

  function closeForm() {
    setEditingUser(null);
    setFormError(null);
  }

  function toggleRole(id: string) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(id) ? prev.roles.filter((r) => r !== id) : [...prev.roles, id],
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, input: form });
    }
  }

  function onDelete(user: User) {
    if (window.confirm(t('users.deleteConfirm'))) {
      deleteMutation.mutate(user.id);
    }
  }

  const columns: Column<User>[] = [
    { key: 'name', header: t('users.columns.name'), render: (row) => row.name },
    { key: 'email', header: t('users.columns.email'), render: (row) => row.email },
    {
      key: 'status',
      header: t('users.columns.status'),
      render: (row) => (row.isActive ? t('common.active') : t('common.inactive')),
    },
    { key: 'roles', header: t('users.columns.roles'), render: (row) => row.roles.length },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-2">
          <PermissionGate permission="users.update">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t('common.edit')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="users.delete">
            <Button variant="danger" onClick={() => onDelete(row)}>
              {t('common.delete')}
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('users.title')}</h1>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('users.searchPlaceholder')}
      />

      {editingUser && (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {t('users.editUser')} — {editingUser.email}
          </h2>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t('common.active')}
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900">{t('users.assignRoles')}</legend>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-gray-200 p-3">
              {allRoles?.data.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  {role.name}
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
            <Button type="submit" disabled={updateMutation.isPending}>
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
