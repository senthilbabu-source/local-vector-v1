import { z } from 'zod';

/**
 * Shared password rule — enforced identically on both client and server.
 * Min 8 chars, at least one uppercase, one lowercase, one digit.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  business_name: z.string().min(2, 'Business name must be at least 2 characters').max(255),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
