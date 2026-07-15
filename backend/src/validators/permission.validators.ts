import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Use lowercase letters, numbers, and . _ - separators only (e.g. "users.read")');

export const createPermissionSchema = z.object({
  body: z.object({
    name: nameSchema,
    description: z.string().trim().min(1).max(300),
  }),
});

export const updatePermissionSchema = z.object({
  body: z
    .object({
      name: nameSchema.optional(),
      description: z.string().trim().min(1).max(300).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided'),
});

export type CreatePermissionBody = z.infer<typeof createPermissionSchema>['body'];
export type UpdatePermissionBody = z.infer<typeof updatePermissionSchema>['body'];
