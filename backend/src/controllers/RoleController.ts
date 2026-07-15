import { Request, Response } from 'express';
import { RoleService } from '../services/RoleService';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { CreateRoleBody, UpdateRoleBody } from '../validators/role.validators';

function requestContext(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, actorId: req.auth!.userId };
}

export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreateRoleBody;
    const role = await this.roleService.create(input, requestContext(req));
    res.status(201).json({ data: role });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const { items, meta } = await this.roleService.list({ search }, pagination);
    res.status(200).json({ data: items, meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const role = await this.roleService.getById(req.params.id);
    res.status(200).json({ data: role });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdateRoleBody;
    const role = await this.roleService.update(req.params.id, input, requestContext(req));
    res.status(200).json({ data: role });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.roleService.delete(req.params.id, requestContext(req));
    res.status(204).send();
  });
}
