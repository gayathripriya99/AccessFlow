import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RequirePermission } from './auth/RequirePermission';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="users"
              element={
                <RequirePermission permission="users.read">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="roles"
              element={
                <RequirePermission permission="roles.read">
                  <RolesPage />
                </RequirePermission>
              }
            />
            <Route
              path="permissions"
              element={
                <RequirePermission permission="permissions.read">
                  <PermissionsPage />
                </RequirePermission>
              }
            />
            <Route
              path="audit-logs"
              element={
                <RequirePermission permission="auditlogs.read">
                  <AuditLogsPage />
                </RequirePermission>
              }
            />
            {/*
              Single catch-all for every unmatched path, nested here (not also
              duplicated at the top level) because ProtectedRoute is pathless —
              it matches any URL structurally and only decides via its own
              render logic whether to show this NotFoundPage (authenticated,
              nav still visible) or redirect to /login (unauthenticated),
              before this route's element ever renders. A second top-level "*"
              would just tie with this one on route-matching score.
            */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
