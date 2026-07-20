import { Router } from 'express';
import { UserController } from '../../controllers/UserController';
import { UserService } from '../../services/UserService';
import { UserRepository } from '../../repositories/UserRepository';
import { RoleRepository } from '../../repositories/RoleRepository';
import { RefreshTokenRepository } from '../../repositories/RefreshTokenRepository';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { validateObjectIdParam } from '../../middlewares/validateObjectIdParam';
import { requireAuth } from '../../middlewares/requireAuth';
import { requirePermission } from '../../middlewares/requirePermission';
import { requireAccess } from '../../middlewares/requireAccess';
import { AuthorizationService } from '../../services/AuthorizationService';
import { listUsersQuerySchema, updateUserSchema } from '../../validators/user.validators';

const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const userService = new UserService(
  userRepository,
  roleRepository,
  new RefreshTokenRepository(),
  new AuditLogRepository(),
  new AuthorizationService(userRepository, roleRepository),
);
const userController = new UserController(userService);

export const userRouter = Router();

userRouter.use(requireAuth);

// List has no single :id to evaluate ABAC against — permission-gated only,
// same as every other list endpoint.
userRouter.get('/', requirePermission('users.read'), validateRequest(listUsersQuerySchema), userController.list);
// The three single-resource routes below go through requireAccess (Phase 8)
// instead of requirePermission directly: ABAC policies (e.g. "view your own
// profile") are checked first, RBAC only as the fallback when no policy
// matches — see requireAccess's doc comment and backend/Phase-08.md.
userRouter.get(
  '/:id',
  requireAccess('user', 'read', 'users.read'),
  validateObjectIdParam(),
  userController.getById,
);
userRouter.patch(
  '/:id',
  requireAccess('user', 'update', 'users.update'),
  validateObjectIdParam(),
  validateRequest(updateUserSchema),
  userController.update,
);
userRouter.delete(
  '/:id',
  requireAccess('user', 'delete', 'users.delete'),
  validateObjectIdParam(),
  userController.delete,
);
