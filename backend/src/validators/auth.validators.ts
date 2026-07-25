import { z } from 'zod';

const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens only (e.g. "acme-corp")');

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');
const nameSchema = z.string().trim().min(1).max(120);

// Phase 9: registration is a discriminated union — 'create' starts a brand
// new organization (the registrant becomes its bootstrap admin, same
// idempotent seeding as before, just scoped to the new tenant); 'join'
// registers into an existing organization as a roleless user (same as every
// non-first registration always was, just per-tenant instead of per-database).
export const registerSchema = z.object({
  body: z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('create'),
      email: emailSchema,
      password: passwordSchema,
      name: nameSchema,
      tenantName: z.string().trim().min(1).max(120),
      tenantSlug: tenantSlugSchema,
    }),
    z.object({
      mode: z.literal('join'),
      email: emailSchema,
      password: passwordSchema,
      name: nameSchema,
      tenantSlug: tenantSlugSchema,
    }),
  ]),
});

// tenantSlug is required at login since email uniqueness is now per-tenant —
// the same address can hold separate accounts in separate organizations, so
// the slug is what disambiguates which account to authenticate against.
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1),
    tenantSlug: tenantSlugSchema,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
