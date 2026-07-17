import { Router } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { AuthService } from '../../services/AuthService';
import { AdminBootstrapService } from '../../services/AdminBootstrapService';
import { AuthorizationService } from '../../services/AuthorizationService';
import { UserRepository } from '../../repositories/UserRepository';
import { RefreshTokenRepository } from '../../repositories/RefreshTokenRepository';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { RoleRepository } from '../../repositories/RoleRepository';
import { PermissionRepository } from '../../repositories/PermissionRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import { requireAuth } from '../../middlewares/requireAuth';
import { loginSchema, registerSchema } from '../../validators/auth.validators';

const userRepository = new UserRepository();
const adminBootstrapService = new AdminBootstrapService(
  userRepository,
  new RoleRepository(),
  new PermissionRepository(),
);
const authService = new AuthService(
  userRepository,
  new RefreshTokenRepository(),
  new AuditLogRepository(),
  adminBootstrapService,
  new AuthorizationService(userRepository),
);
const authController = new AuthController(authService);

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateRequest(registerSchema), authController.register);
authRouter.post('/login', authRateLimiter, validateRequest(loginSchema), authController.login);
authRouter.post('/refresh', authRateLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
