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
