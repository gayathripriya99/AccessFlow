import { Request, Response } from 'express';
import { AuditLogService } from '../services/AuditLogService';
import { AuditAction } from '../models/AuditLog';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req);
    const { action, userId, from, to } = req.query;
    const { items, meta } = await this.auditLogService.list(
      {
        action: typeof action === 'string' ? (action as AuditAction) : undefined,
        userId: typeof userId === 'string' ? userId : undefined,
        from: typeof from === 'string' ? new Date(from) : undefined,
        to: typeof to === 'string' ? new Date(to) : undefined,
      },
      pagination,
    );
    res.status(200).json({ data: items, meta });
  });
}
