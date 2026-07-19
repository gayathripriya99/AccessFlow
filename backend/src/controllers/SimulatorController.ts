import { Request, Response } from 'express';
import { SimulatorService } from '../services/SimulatorService';
import { asyncHandler } from '../utils/asyncHandler';
import { SimulateBody } from '../validators/simulator.validators';

export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  check = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as SimulateBody;
    const result =
      body.mode === 'user'
        ? await this.simulatorService.simulateForUser(body.userId, body.permission)
        : await this.simulatorService.simulateForRoles(body.roleIds, body.permission);
    res.status(200).json({ data: result });
  });
}
