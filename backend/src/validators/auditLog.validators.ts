import { z } from 'zod';
import { AUDIT_ACTIONS } from '../models/AuditLog';

const dateString = z.string().refine((value) => !isNaN(Date.parse(value)), 'Invalid date');

export const listAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    action: z.enum(AUDIT_ACTIONS).optional(),
    userId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId')
      .optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  }),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>['query'];
