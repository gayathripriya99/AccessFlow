import { Router } from 'express';
import { RoleController } from '../../controllers/RoleController';
import { RoleService } from '../../services/RoleService';
import { RoleRepository } from '../../repositories/RoleRepository';
import { PermissionRepository } from '../../repositories/PermissionRepository';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { validateObjectIdParam } from '../../middlewares/validateObjectIdParam';
import { requireAuth } from '../../middlewares/requireAuth';
import { requirePermission } from '../../middlewares/requirePermission';
import { createRoleSchema, updateRoleSchema } from '../../validators/role.validators';
import { listQuerySchema } from '../../validators/pagination.validators';

const roleService = new RoleService(new RoleRepository(), new PermissionRepository(), new AuditLogRepository());
const roleController = new RoleController(roleService);

export const roleRouter = Router();

roleRouter.use(requireAuth);

roleRouter.post('/', requirePermission('roles.create'), validateRequest(createRoleSchema), roleController.create);
roleRouter.get('/', requirePermission('roles.read'), validateRequest(listQuerySchema), roleController.list);
roleRouter.get('/:id', requirePermission('roles.read'), validateObjectIdParam(), roleController.getById);
roleRouter.patch(
  '/:id',
  requirePermission('roles.update'),
  validateObjectIdParam(),
  validateRequest(updateRoleSchema),
  roleController.update,
);
roleRouter.delete('/:id', requirePermission('roles.delete'), validateObjectIdParam(), roleController.delete);
