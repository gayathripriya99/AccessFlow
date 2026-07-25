import { CookieOptions, Response } from 'express';
import { env } from '../config/env';

// Cross-origin in production (frontend on Vercel, backend on Render — different
// origins) needs SameSite=None to have the browser attach the cookie to the
// refresh/logout fetch calls at all; SameSite=None requires Secure, which
// isProduction already guarantees. Dev keeps Lax since localhost:5173 → :4000
// is same-site (same registrable domain, only the port differs).
const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/v1/auth',
};

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.refreshCookieName, token, { ...baseCookieOptions, expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.refreshCookieName, baseCookieOptions);
}
