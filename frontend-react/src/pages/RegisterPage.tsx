import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { registerSchema } from '../auth/validators';
import type { RegisterFormValues } from '../auth/validators';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';
import { getErrorMessage } from '../api/errors';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitError(null);
    try {
      await registerUser(values);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      setSubmitError(getErrorMessage(err, t));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">{t('auth.register.title')}</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('auth.register.name')}
            error={errors.name ? t('auth.validation.nameRequired') : undefined}
            {...register('name')}
          />
          <FormField
            label={t('common.email')}
            type="email"
            error={errors.email ? t('auth.validation.emailRequired') : undefined}
            {...register('email')}
          />
          <FormField
            label={t('common.password')}
            type="password"
            error={errors.password ? t('auth.validation.passwordWeak') : undefined}
            {...register('password')}
          />
          {submitError && (
            <p className="text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {t('auth.register.submit')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
