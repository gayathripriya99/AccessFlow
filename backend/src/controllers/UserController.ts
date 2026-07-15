import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { UpdateUserBody } from '../validators/user.validators';

function requestContext(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, actorId: req.auth!.userId };
}

export class UserController {
  constructor(private readonly userService: UserService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const isActive = req.query.isActive === undefined ? undefined : req.query.isActive === 'true';
    const { items, meta } = await this.userService.list({ search, isActive }, pagination);
    res.status(200).json({ data: items, meta });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.userService.getById(req.params.id);
    res.status(200).json({ data: user });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = req.body as UpdateUserBody;
    const user = await this.userService.update(req.params.id, input, requestContext(req));
    res.status(200).json({ data: user });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.userService.delete(req.params.id, requestContext(req));
    res.status(204).send();
  });
}
