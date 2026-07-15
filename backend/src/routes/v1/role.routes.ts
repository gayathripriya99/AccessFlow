import { Router } from 'express';
import { RoleController } from '../../controllers/RoleController';
import { RoleService } from '../../services/RoleService';
import { RoleRepository } from '../../repositories/RoleRepository';
import { PermissionRepository } from '../../repositories/PermissionRepository';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { validateObjectIdParam } from '../../middlewares/validateObjectIdParam';
import { requireAuth } from '../../middlewares/requireAuth';
import { createRoleSchema, updateRoleSchema } from '../../validators/role.validators';
import { listQuerySchema } from '../../validators/pagination.validators';

const roleService = new RoleService(new RoleRepository(), new PermissionRepository(), new AuditLogRepository());
const roleController = new RoleController(roleService);

export const roleRouter = Router();

roleRouter.use(requireAuth);

roleRouter.post('/', validateRequest(createRoleSchema), roleController.create);
roleRouter.get('/', validateRequest(listQuerySchema), roleController.list);
roleRouter.get('/:id', validateObjectIdParam(), roleController.getById);
roleRouter.patch('/:id', validateObjectIdParam(), validateRequest(updateRoleSchema), roleController.update);
roleRouter.delete('/:id', validateObjectIdParam(), roleController.delete);
