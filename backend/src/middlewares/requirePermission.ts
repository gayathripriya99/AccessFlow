import { NextFunction, Request, Response } from 'express';
import { AuthorizationService } from '../services/AuthorizationService';
import { UserRepository } from '../repositories/UserRepository';
import { ApiError } from '../utils/ApiError';

const authorizationService = new AuthorizationService(new UserRepository());

/**
 * Guards a route behind a specific permission name, resolved from the
 * caller's roles (never a hardcoded role-name check). Must run after
 * requireAuth, which populates req.auth.
 */
export function requirePermission(permissionName: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = await authorizationService.getPermissionNames(req.auth!.userId);
      if (!permissions.has(permissionName)) {
        next(ApiError.forbidden(`Missing required permission: ${permissionName}`));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
