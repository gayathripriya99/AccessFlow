import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      isActive: z.boolean().optional(),
      roles: z.array(objectIdSchema).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided'),
});

export const listUsersQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().trim().max(200).optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});

export type UpdateUserBody = z.infer<typeof updateUserSchema>['body'];
