import { Request, Response } from 'express';
import { PolicyService } from '../services/PolicyService';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { CreatePolicyBody, UpdatePolicyBody } from '../validators/policy.validators';

function requestContext(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, actorId: req.auth!.userId };
}

export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreatePolicyBody;
    const policy = await this.policyService.create(input, requestContext(req));
    res.status(201).json({ data: policy });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const { items, meta } = await this.policyService.list({ search }, pagination);
    res.status(200).json({ data: items, meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const policy = await this.policyService.getById(req.params.id);
    res.status(200).json({ data: policy });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdatePolicyBody;
    const policy = await this.policyService.update(req.params.id, input, requestContext(req));
    res.status(200).json({ data: policy });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.policyService.delete(req.params.id, requestContext(req));
    res.status(204).send();
  });
}
