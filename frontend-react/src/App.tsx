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

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/users"
              element={
                <RequirePermission permission="users.read">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="/roles"
              element={
                <RequirePermission permission="roles.read">
                  <RolesPage />
                </RequirePermission>
              }
            />
            <Route
              path="/permissions"
              element={
                <RequirePermission permission="permissions.read">
                  <PermissionsPage />
                </RequirePermission>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
