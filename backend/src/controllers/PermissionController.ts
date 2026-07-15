import { Request, Response } from 'express';
import { PermissionService } from '../services/PermissionService';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { CreatePermissionBody, UpdatePermissionBody } from '../validators/permission.validators';

function requestContext(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, actorId: req.auth!.userId };
}

export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as CreatePermissionBody;
    const permission = await this.permissionService.create(input, requestContext(req));
    res.status(201).json({ data: permission });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const { items, meta } = await this.permissionService.list({ search }, pagination);
    res.status(200).json({ data: items, meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const permission = await this.permissionService.getById(req.params.id);
    res.status(200).json({ data: permission });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdatePermissionBody;
    const permission = await this.permissionService.update(req.params.id, input, requestContext(req));
    res.status(200).json({ data: permission });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.permissionService.delete(req.params.id, requestContext(req));
    res.status(204).send();
  });
}
