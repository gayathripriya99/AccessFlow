import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { simulate } from '../api/simulator';
import { listUsers } from '../api/users';
import { listRoles } from '../api/roles';
import { listPermissions } from '../api/permissions';
import { getErrorMessage } from '../api/errors';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';

type Mode = 'user' | 'roles';

export function PermissionSimulatorPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('user');
  const [userId, setUserId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [permission, setPermission] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => listUsers({ page: 1, limit: 100 }),
    enabled: mode === 'user',
  });
  const { data: roles } = useQuery({
    queryKey: ['roles', 'all'],
    queryFn: () => listRoles({ page: 1, limit: 100 }),
    enabled: mode === 'roles',
  });
  const { data: permissions } = useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: () => listPermissions({ page: 1, limit: 100 }),
  });

  const mutation = useMutation({
    mutationFn: simulate,
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    mutation.reset();

    if (!permission) {
      setFormError(t('simulator.selectPermissionError'));
      return;
    }
    if (mode === 'user') {
      if (!userId) {
        setFormError(t('simulator.selectUserError'));
        return;
      }
      mutation.mutate({ mode: 'user', userId, permission });
    } else {
      if (roleIds.length === 0) {
        setFormError(t('simulator.selectRolesError'));
        return;
      }
      mutation.mutate({ mode: 'roles', roleIds, permission });
    }
  }

  const result = mutation.data;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('simulator.title')}</h1>
      <p className="max-w-2xl text-sm text-gray-600">{t('simulator.description')}</p>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-gray-900">{t('simulator.modeLabel')}</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="simulator-mode"
                checked={mode === 'user'}
                onChange={() => setMode('user')}
              />
              {t('simulator.modeUser')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="simulator-mode"
                checked={mode === 'roles'}
                onChange={() => setMode('roles')}
              />
              {t('simulator.modeRoles')}
            </label>
          </div>
        </fieldset>

        {mode === 'user' ? (
          <FormField label={t('simulator.selectUser')} id="simulator-user">
            <select
              id="simulator-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              <option value="">{t('simulator.selectUserPlaceholder')}</option>
              {users?.data.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900">{t('simulator.selectRoles')}</legend>
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-gray-200 p-3">
              {roles?.data.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <FormField label={t('simulator.permission')} id="simulator-permission">
          <select
            id="simulator-permission"
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          >
            <option value="">{t('simulator.selectPermissionPlaceholder')}</option>
            {permissions?.data.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>

        {formError && (
          <p className="text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}

        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {t('simulator.run')}
          </Button>
        </div>
      </form>

      {result && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
          <div
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${
              result.allowed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {result.allowed ? t('simulator.allowed') : t('simulator.denied')}
          </div>

          {result.userActive === false && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700" role="status">
              {t('simulator.userInactiveWarning')}
            </p>
          )}

          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{t('simulator.grantedBy')}</h2>
            {result.grantedByRoles.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {result.grantedByRoles.map((name) => (
                  <li key={name} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">{t('simulator.notGrantedByAny')}</p>
            )}
          </div>

          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{t('simulator.resolvedPermissions')}</h2>
            <ul className="flex flex-wrap gap-2">
              {result.resolvedPermissions.map((name) => (
                <li key={name} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
