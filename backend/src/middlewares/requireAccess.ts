import { NextFunction, Request, Response } from 'express';
import { AbacService } from '../services/AbacService';
import { AuthorizationService } from '../services/AuthorizationService';
import { PolicyRepository } from '../repositories/PolicyRepository';
import { UserRepository } from '../repositories/UserRepository';
import { RoleRepository } from '../repositories/RoleRepository';
import { ApiError } from '../utils/ApiError';

const abacService = new AbacService(new PolicyRepository());
const authorizationService = new AuthorizationService(new UserRepository(), new RoleRepository());

/**
 * Guards a single-resource route (one with a `:id` param) behind ABAC
 * policies first, RBAC second — the Phase 8 combination. Evaluates policies
 * for `resourceType`+`action` against `{ subject: caller, resource: :id }`:
 * an explicit `deny` policy always wins (403, RBAC never consulted); an
 * `allow` policy grants access even without `fallbackPermission`; if no
 * policy matches either way, falls back to an ordinary requirePermission-style
 * check. Must run after requireAuth and validateObjectIdParam.
 */
export function requireAccess(resourceType: string, action: string, fallbackPermission: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const decision = await abacService.evaluate({
        subject: { id: req.auth!.userId },
        resource: { type: resourceType, id: req.params.id },
        action,
      });

      if (decision === 'deny') {
        next(ApiError.forbidden(`Denied by policy for ${resourceType}.${action}`));
        return;
      }
      if (decision === 'allow') {
        next();
        return;
      }

      const permissions = await authorizationService.getPermissionNames(req.auth!.userId);
      if (!permissions.has(fallbackPermission)) {
        next(ApiError.forbidden(`Missing required permission: ${fallbackPermission}`));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
