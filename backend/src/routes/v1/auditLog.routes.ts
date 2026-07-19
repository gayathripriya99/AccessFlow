import { Router } from 'express';
import { AuditLogController } from '../../controllers/AuditLogController';
import { AuditLogService } from '../../services/AuditLogService';
import { AuditLogRepository } from '../../repositories/AuditLogRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { requireAuth } from '../../middlewares/requireAuth';
import { requirePermission } from '../../middlewares/requirePermission';
import { listAuditLogsQuerySchema } from '../../validators/auditLog.validators';

const auditLogService = new AuditLogService(new AuditLogRepository());
const auditLogController = new AuditLogController(auditLogService);

export const auditLogRouter = Router();

auditLogRouter.use(requireAuth);

auditLogRouter.get(
  '/',
  requirePermission('auditlogs.read'),
  validateRequest(listAuditLogsQuerySchema),
  auditLogController.list,
);
