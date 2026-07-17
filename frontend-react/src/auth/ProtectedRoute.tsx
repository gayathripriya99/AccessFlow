import { Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { status } = useAuth();
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        {t('common.loading')}
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
