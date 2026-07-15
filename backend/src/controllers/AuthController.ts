import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { clearRefreshCookie, setRefreshCookie } from '../utils/cookies';
import { getTokenExpiry } from '../utils/jwt';
import { env } from '../config/env';
import { LoginInput, RegisterInput } from '../validators/auth.validators';

function requestContext(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

function extractRefreshToken(req: Request): string {
  const token = req.cookies?.[env.refreshCookieName];
  if (!token) {
    throw ApiError.unauthorized('Missing refresh token');
  }
  return token;
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as RegisterInput;
    const user = await this.authService.register(input, requestContext(req));
    res.status(201).json({ data: user });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as LoginInput;
    const { user, accessToken, refreshToken } = await this.authService.login(input, requestContext(req));
    setRefreshCookie(res, refreshToken, getTokenExpiry(refreshToken));
    res.status(200).json({ data: { user, accessToken } });
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const presentedToken = extractRefreshToken(req);
    const { accessToken, refreshToken } = await this.authService.refresh(presentedToken, requestContext(req));
    setRefreshCookie(res, refreshToken, getTokenExpiry(refreshToken));
    res.status(200).json({ data: { accessToken } });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const presentedToken = req.cookies?.[env.refreshCookieName];
    if (presentedToken) {
      await this.authService.logout(presentedToken, requestContext(req));
    }
    clearRefreshCookie(res);
    res.status(204).send();
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.authService.getCurrentUser(req.auth!.userId);
    res.status(200).json({ data: user });
  });
}
