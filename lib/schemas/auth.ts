import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, isCommonPassword } from '@/lib/auth/password-policy';
import { sanitizeName, hasSuspiciousPatterns } from '@/lib/auth/input-sanitizer';

/**
 * Shared password rule — enforced identically on both client and server.
 * §314: Min 8 chars, max 72 (bcrypt limit), uppercase, lowercase, digit.
 *        Rejects common breached passwords.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine((pw) => !isCommonPassword(pw), {
    message: 'This password is too common. Please choose a stronger password.',
  });

/**
 * §314: Name field schema with sanitization transform.
 * Strips HTML, control chars, normalizes whitespace.
 * Rejects suspicious injection patterns.
 */
const nameSchema = (fieldLabel: string) =>
  z
    .string()
    .min(2, `${fieldLabel} must be at least 2 characters`)
    .max(100, `${fieldLabel} must be at most 100 characters`)
    .transform(sanitizeName)
    .pipe(
      z
        .string()
        .min(2, `${fieldLabel} must be at least 2 characters after cleanup`)
        .refine((v) => !hasSuspiciousPatterns(v), {
          message: `${fieldLabel} contains invalid characters`,
        }),
    );

export const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: passwordSchema,
    full_name: nameSchema('Full name'),
    business_name: nameSchema('Business name'),
  })
  .refine(
    (data) => {
      // §314: Prevent email local part in password
      const localPart = data.email.split('@')[0];
      if (!localPart || localPart.length < 3) return true;
      return !data.password.toLowerCase().includes(localPart.toLowerCase());
    },
    {
      message: 'Password must not contain your email address',
      path: ['password'],
    },
  );

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
