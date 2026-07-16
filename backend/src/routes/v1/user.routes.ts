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
import { listUsersQuerySchema, updateUserSchema } from '../../validators/user.validators';

const userService = new UserService(
  new UserRepository(),
  new RoleRepository(),
  new RefreshTokenRepository(),
  new AuditLogRepository(),
);
const userController = new UserController(userService);

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get('/', requirePermission('users.read'), validateRequest(listUsersQuerySchema), userController.list);
userRouter.get('/:id', requirePermission('users.read'), validateObjectIdParam(), userController.getById);
userRouter.patch(
  '/:id',
  requirePermission('users.update'),
  validateObjectIdParam(),
  validateRequest(updateUserSchema),
  userController.update,
);
userRouter.delete('/:id', requirePermission('users.delete'), validateObjectIdParam(), userController.delete);
