import { CookieOptions, Response } from 'express';
import { env } from '../config/env';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/api/v1/auth',
};

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.refreshCookieName, token, { ...baseCookieOptions, expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.refreshCookieName, baseCookieOptions);
}
