/**
 * Access token lives in memory only (never localStorage — avoids XSS token
 * theft). The refresh token is an httpOnly cookie the browser already sends
 * automatically (set by the backend, Phase 1); this module has no access to
 * it and doesn't need any. Plain module state (not React context) so the
 * axios interceptor in api/client.ts can read/clear it without importing
 * React or creating a circular dependency with AuthProvider.
 */
let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setOnAuthFailure(callback: (() => void) | null): void {
  onAuthFailure = callback;
}

export function notifyAuthFailure(): void {
  onAuthFailure?.();
}
