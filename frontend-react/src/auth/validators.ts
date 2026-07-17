import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
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
