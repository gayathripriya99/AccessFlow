import { Router } from 'express';
import { PolicyController } from '../../controllers/PolicyController';
import { PolicyService } from '../../services/PolicyService';
import { PolicyRepository } from '../../repositories/PolicyRepository';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { validateObjectIdParam } from '../../middlewares/validateObjectIdParam';
import { requireAuth } from '../../middlewares/requireAuth';
import { requirePermission } from '../../middlewares/requirePermission';
import { createPolicySchema, updatePolicySchema } from '../../validators/policy.validators';
import { listQuerySchema } from '../../validators/pagination.validators';

const policyService = new PolicyService(new PolicyRepository(), new AuditLogRepository());
const policyController = new PolicyController(policyService);

export const policyRouter = Router();

policyRouter.use(requireAuth);

policyRouter.post(
  '/',
  requirePermission('policies.create'),
  validateRequest(createPolicySchema),
  policyController.create,
);
policyRouter.get('/', requirePermission('policies.read'), validateRequest(listQuerySchema), policyController.list);
policyRouter.get('/:id', requirePermission('policies.read'), validateObjectIdParam(), policyController.getById);
policyRouter.patch(
  '/:id',
  requirePermission('policies.update'),
  validateObjectIdParam(),
  validateRequest(updatePolicySchema),
  policyController.update,
);
policyRouter.delete(
  '/:id',
  requirePermission('policies.delete'),
  validateObjectIdParam(),
  policyController.delete,
);
