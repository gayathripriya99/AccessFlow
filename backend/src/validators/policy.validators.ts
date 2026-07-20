import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Use lowercase letters, numbers, and . _ - separators only (e.g. "deny-self-delete")');

// Only 'user' supports ABAC checks so far (see requireAccess call sites in
// user.routes.ts) — a closed enum here rather than an open string keeps a
// policy from silently never matching anything because of a typo, and is
// easy to widen later as more resources gain ABAC support.
const resourceSchema = z.enum(['user']);
const actionSchema = z.enum(['read', 'update', 'delete']);

const conditionSchema = z.object({
  attribute: z.string().trim().min(1).max(100),
  operator: z.enum(['equals', 'notEquals']),
  compareTo: z.string().trim().min(1).max(200),
});

export const createPolicySchema = z.object({
  body: z.object({
    name: nameSchema,
    description: z.string().trim().min(1).max(300),
    resource: resourceSchema,
    action: actionSchema,
    effect: z.enum(['allow', 'deny']),
    conditions: z.array(conditionSchema).min(1).max(10),
    enabled: z.boolean().optional().default(true),
  }),
});

export const updatePolicySchema = z.object({
  body: z
    .object({
      name: nameSchema.optional(),
      description: z.string().trim().min(1).max(300).optional(),
      resource: resourceSchema.optional(),
      action: actionSchema.optional(),
      effect: z.enum(['allow', 'deny']).optional(),
      conditions: z.array(conditionSchema).min(1).max(10).optional(),
      enabled: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided'),
});

export type CreatePolicyBody = z.infer<typeof createPolicySchema>['body'];
export type UpdatePolicyBody = z.infer<typeof updatePolicySchema>['body'];
