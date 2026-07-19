import { Router } from 'express';
import { SimulatorController } from '../../controllers/SimulatorController';
import { SimulatorService } from '../../services/SimulatorService';
import { UserRepository } from '../../repositories/UserRepository';
import { RoleRepository } from '../../repositories/RoleRepository';
import { validateRequest } from '../../middlewares/validateRequest';
import { requireAuth } from '../../middlewares/requireAuth';
import { requirePermission } from '../../middlewares/requirePermission';
import { simulateSchema } from '../../validators/simulator.validators';

const simulatorService = new SimulatorService(new UserRepository(), new RoleRepository());
const simulatorController = new SimulatorController(simulatorService);

export const simulatorRouter = Router();

simulatorRouter.use(requireAuth);

simulatorRouter.post(
  '/check',
  requirePermission('simulator.run'),
  validateRequest(simulateSchema),
  simulatorController.check,
);
