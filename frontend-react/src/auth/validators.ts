import { z } from 'zod';

// Phase 9: organization slugs are the one thing that stays globally unique —
// mirrors backend/src/validators/auth.validators.ts's tenantSlugSchema.
const tenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/);

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  tenantSlug: tenantSlugSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// `tenantName` is only actually required in 'create' mode, but react-hook-form's
// FieldErrors/register typing doesn't cope well with a Zod discriminated union
// where a field only exists on one branch — so this stays one flat schema
// (tenantName optional at the schema level) and RegisterPage enforces the
// create-mode requirement itself (mode is local component state, not a form
// field) before building the actual discriminated RegisterInput payload.
export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: passwordSchema,
  tenantName: z.string().trim().optional(),
  tenantSlug: tenantSlugSchema,
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const nameDescriptionSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

export type NameDescriptionFormValues = z.infer<typeof nameDescriptionSchema>;

/** Shared by RolesPage/PermissionsPage's plain (non-react-hook-form) create/edit forms — returns per-field error flags, or null when valid. */
export function validateNameDescription(input: {
  name: string;
  description: string;
}): { name: boolean; description: boolean } | null {
  const result = nameDescriptionSchema.safeParse(input);
  if (result.success) {
    return null;
  }
  const fieldErrors = result.error.flatten().fieldErrors;
  return { name: Boolean(fieldErrors.name), description: Boolean(fieldErrors.description) };
}
