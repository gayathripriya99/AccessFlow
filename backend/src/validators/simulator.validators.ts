import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

const permissionNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Use lowercase letters, numbers, and . _ - separators only (e.g. "users.read")');

export const simulateSchema = z.object({
  body: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('user'), userId: objectIdSchema, permission: permissionNameSchema }),
    z.object({
      mode: z.literal('roles'),
      roleIds: z.array(objectIdSchema).min(1).max(20),
      permission: permissionNameSchema,
    }),
  ]),
});

export type SimulateBody = z.infer<typeof simulateSchema>['body'];
