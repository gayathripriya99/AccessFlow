import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { CurrentUser } from '../api/types';
import { refreshAccessToken } from '../api/client';
import { setAccessToken, setOnAuthFailure } from './tokenStore';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  currentUser: CurrentUser | null;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: authApi.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // `reason: 'expired'` distinguishes an active session dying mid-use (axios
  // interceptor's refresh-retry failed) from a plain logged-out state (initial
  // silent-refresh on mount finding no cookie, or an explicit logout) — only
  // the former should show LoginPage's "your session expired" banner.
  const clearSession = useCallback((reason?: 'expired') => {
    setAccessToken(null);
    setCurrentUser(null);
    setStatus('unauthenticated');
    setSessionExpired(reason === 'expired');
  }, []);

  useEffect(() => {
    setOnAuthFailure(() => clearSession('expired'));
    return () => setOnAuthFailure(null);
  }, [clearSession]);

  useEffect(() => {
    // The access token lives only in memory, so a page refresh loses it —
    // silently try the refresh cookie (Phase 1's httpOnly cookie) before
    // deciding the user is logged out.
    (async () => {
      try {
        const accessToken = await refreshAccessToken();
        setAccessToken(accessToken);
        const user = await authApi.getCurrentUser();
        setCurrentUser(user);
        setStatus('authenticated');
      } catch {
        clearSession();
      }
    })();
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    setAccessToken(result.accessToken);
    const user = await authApi.getCurrentUser();
    setCurrentUser(user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (input: authApi.RegisterInput) => {
    await authApi.register(input);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const hasPermission = useCallback(
    (permission: string) => currentUser?.permissions.includes(permission) ?? false,
    [currentUser],
  );

  const value = useMemo(
    () => ({ status, currentUser, sessionExpired, login, register, logout, hasPermission }),
    [status, currentUser, sessionExpired, login, register, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
