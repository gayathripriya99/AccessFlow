import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

const nameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Use lowercase letters, numbers, and . _ - separators only (e.g. "content-editor")');

export const createRoleSchema = z.object({
  body: z.object({
    name: nameSchema,
    description: z.string().trim().min(1).max(300),
    permissions: z.array(objectIdSchema).optional().default([]),
  }),
});

export const updateRoleSchema = z.object({
  body: z
    .object({
      name: nameSchema.optional(),
      description: z.string().trim().min(1).max(300).optional(),
      permissions: z.array(objectIdSchema).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided'),
});

export type CreateRoleBody = z.infer<typeof createRoleSchema>['body'];
export type UpdateRoleBody = z.infer<typeof updateRoleSchema>['body'];
