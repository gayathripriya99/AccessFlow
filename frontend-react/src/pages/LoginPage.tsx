import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { loginSchema } from '../auth/validators';
import type { LoginFormValues } from '../auth/validators';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { getErrorMessage } from '../api/errors';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { registered?: boolean; sessionExpired?: boolean } | null;
  const justRegistered = Boolean(navState?.registered);
  const sessionExpired = Boolean(navState?.sessionExpired);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(getErrorMessage(err, t));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('auth.login.title')}</h1>
        {justRegistered && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
            {t('auth.register.success')}
          </p>
        )}
        {sessionExpired && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700" role="alert">
            {t('auth.login.sessionExpired')}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('common.email')}
            type="email"
            error={errors.email ? t('auth.validation.emailRequired') : undefined}
            {...register('email')}
          />
          <FormField
            label={t('common.password')}
            type="password"
            error={errors.password ? t('auth.validation.passwordRequired') : undefined}
            {...register('password')}
          />
          {submitError && (
            <p className="text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {t('auth.login.submit')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            {t('auth.login.registerLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
