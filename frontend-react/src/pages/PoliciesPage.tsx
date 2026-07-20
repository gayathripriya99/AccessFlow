import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPolicy, deletePolicy, listPolicies, updatePolicy } from '../api/policies';
import type { CreatePolicyInput } from '../api/policies';
import { validateNameDescription } from '../auth/validators';
import type { Policy, PolicyAction, PolicyCondition, PolicyEffect, PolicyOperator, PolicyResource } from '../api/types';
import { getErrorMessage } from '../api/errors';
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
  resource: PolicyResource;
  action: PolicyAction;
  effect: PolicyEffect;
  enabled: boolean;
  conditions: PolicyCondition[];
}

const EMPTY_CONDITION: PolicyCondition = { attribute: 'resource.id', operator: 'equals', compareTo: 'subject.id' };
const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  resource: 'user',
  action: 'read',
  effect: 'allow',
  enabled: true,
  conditions: [{ ...EMPTY_CONDITION }],
};

export function PoliciesPage() {
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
    queryKey: ['policies', page, debouncedSearch],
    queryFn: () => listPolicies({ page, limit: 10, search: debouncedSearch || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['policies'] });

  const createMutation = useMutation({
    mutationFn: createPolicy,
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreatePolicyInput }) => updatePolicy(id, input),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (err) => setFormError(getErrorMessage(err, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePolicy,
    onSuccess: invalidate,
  });

  function startCreate() {
    setForm({ ...EMPTY_FORM, conditions: [{ ...EMPTY_CONDITION }] });
    setFormError(null);
    setFieldErrors(null);
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(policy: Policy) {
    setForm({
      name: policy.name,
      description: policy.description,
      resource: policy.resource,
      action: policy.action,
      effect: policy.effect,
      enabled: policy.enabled,
      conditions: policy.conditions.map((c) => ({ ...c })),
    });
    setFormError(null);
    setFieldErrors(null);
    setCreating(false);
    setEditingId(policy.id);
  }

  function closeForm() {
    setCreating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFieldErrors(null);
  }

  function updateCondition(index: number, patch: Partial<PolicyCondition>) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function addCondition() {
    setForm((prev) => ({ ...prev, conditions: [...prev.conditions, { ...EMPTY_CONDITION }] }));
  }

  function removeCondition(index: number) {
    setForm((prev) => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== index) }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errors = validateNameDescription(form);
    setFieldErrors(errors);
    if (errors) {
      return;
    }
    if (form.conditions.length === 0 || form.conditions.some((c) => !c.attribute || !c.compareTo)) {
      setFormError(t('policies.conditionsRequired'));
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, input: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function onDelete(policy: Policy) {
    if (window.confirm(t('policies.deleteConfirm'))) {
      deleteMutation.mutate(policy.id);
    }
  }

  const columns: Column<Policy>[] = [
    { key: 'name', header: t('common.name'), render: (row) => row.name },
    { key: 'resource', header: t('policies.resource'), render: (row) => row.resource },
    { key: 'action', header: t('policies.action'), render: (row) => row.action },
    {
      key: 'effect',
      header: t('policies.effect'),
      render: (row) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            row.effect === 'allow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {row.effect === 'allow' ? t('policies.allow') : t('policies.deny')}
        </span>
      ),
    },
    {
      key: 'enabled',
      header: t('common.status'),
      render: (row) => (row.enabled ? t('common.active') : t('common.inactive')),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-2">
          <PermissionGate permission="policies.update">
            <Button variant="secondary" onClick={() => startEdit(row)}>
              {t('common.edit')}
            </Button>
          </PermissionGate>
          <PermissionGate permission="policies.delete">
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
        <h1 className="text-2xl font-semibold text-gray-900">{t('policies.title')}</h1>
        <PermissionGate permission="policies.create">
          <Button onClick={startCreate}>{t('policies.createPolicy')}</Button>
        </PermissionGate>
      </div>
      <p className="max-w-2xl text-sm text-gray-600">{t('policies.description')}</p>

      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('policies.searchPlaceholder')}
      />

      {formOpen && (
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            {editingId ? t('policies.editPolicy') : t('policies.createPolicy')}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('policies.resource')} id="policy-resource">
              <select
                id="policy-resource"
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value as PolicyResource })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="user">user</option>
              </select>
            </FormField>
            <FormField label={t('policies.action')} id="policy-action">
              <select
                id="policy-action"
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as PolicyAction })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="read">read</option>
                <option value="update">update</option>
                <option value="delete">delete</option>
              </select>
            </FormField>
            <FormField label={t('policies.effect')} id="policy-effect">
              <select
                id="policy-effect"
                value={form.effect}
                onChange={(e) => setForm({ ...form, effect: e.target.value as PolicyEffect })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="allow">{t('policies.allow')}</option>
                <option value="deny">{t('policies.deny')}</option>
              </select>
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            {t('common.active')}
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900">{t('policies.conditions')}</legend>
            <p className="text-xs text-gray-500">{t('policies.conditionsHint')}</p>
            <div className="flex flex-col gap-2">
              {form.conditions.map((condition, index) => (
                <div key={index} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <input
                    aria-label={t('policies.attribute')}
                    placeholder="resource.id"
                    value={condition.attribute}
                    onChange={(e) => updateCondition(index, { attribute: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                  <select
                    aria-label={t('policies.operator')}
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, { operator: e.target.value as PolicyOperator })}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  >
                    <option value="equals">=</option>
                    <option value="notEquals">≠</option>
                  </select>
                  <input
                    aria-label={t('policies.compareTo')}
                    placeholder="subject.id"
                    value={condition.compareTo}
                    onChange={(e) => updateCondition(index, { compareTo: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removeCondition(index)}
                    disabled={form.conditions.length <= 1}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <Button type="button" variant="secondary" onClick={addCondition}>
                {t('policies.addCondition')}
              </Button>
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
