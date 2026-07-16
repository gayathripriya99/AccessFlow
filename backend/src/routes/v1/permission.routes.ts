import { Router } from 'express';
import { PermissionController } from '../../controllers/PermissionController';
import { PermissionService } from '../../services/PermissionService';
import { PermissionRepository } from '../../repositories/PermissionRepository';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { validateObjectIdParam } from '../../middlewares/validateObjectIdParam';
import { requireAuth } from '../../middlewares/requireAuth';
import { requirePermission } from '../../middlewares/requirePermission';
import { createPermissionSchema, updatePermissionSchema } from '../../validators/permission.validators';
import { listQuerySchema } from '../../validators/pagination.validators';

const permissionService = new PermissionService(new PermissionRepository(), new AuditLogRepository());
const permissionController = new PermissionController(permissionService);

export const permissionRouter = Router();

permissionRouter.use(requireAuth);

permissionRouter.post(
  '/',
  requirePermission('permissions.create'),
  validateRequest(createPermissionSchema),
  permissionController.create,
);
permissionRouter.get('/', requirePermission('permissions.read'), validateRequest(listQuerySchema), permissionController.list);
permissionRouter.get('/:id', requirePermission('permissions.read'), validateObjectIdParam(), permissionController.getById);
permissionRouter.patch(
  '/:id',
  requirePermission('permissions.update'),
  validateObjectIdParam(),
  validateRequest(updatePermissionSchema),
  permissionController.update,
);
permissionRouter.delete(
  '/:id',
  requirePermission('permissions.delete'),
  validateObjectIdParam(),
  permissionController.delete,
);
