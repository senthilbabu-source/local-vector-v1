import { z } from 'zod';

/**
 * Zod schema for creating a new location (original — Sprint 62F).
 * Shared between the Server Action (server-side validation)
 * and the AddLocationModal form (client-side validation via react-hook-form).
 */
export const CreateLocationSchema = z.object({
  business_name: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(255),
  address_line1: z
    .string()
    .min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(50),
  zip: z
    .string()
    .min(5, 'ZIP code must be at least 5 digits')
    .max(20),
  phone: z.string().max(50).optional(),
  website_url: z
    .string()
    .url('Must be a valid URL (e.g. https://example.com)')
    .optional()
    .or(z.literal('')),
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;

// ---------------------------------------------------------------------------
// Sprint 100 — Extended schemas for multi-location management
// ---------------------------------------------------------------------------

/**
 * Schema for adding a new location (extends CreateLocationSchema with Sprint 100 fields).
 */
export const AddLocationSchema = CreateLocationSchema.extend({
  display_name: z.string().max(100, 'Display name is too long').optional(),
  timezone: z.string().max(50).optional(),
});

export type AddLocationInput = z.infer<typeof AddLocationSchema>;

/**
 * Schema for updating an existing location. All fields optional (partial update).
 */
export const UpdateLocationSchema = z.object({
  business_name: z.string().min(2).max(255).optional(),
  display_name: z.string().max(100).optional(),
  address_line1: z.string().min(5).optional(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(50).optional(),
  zip: z.string().min(5).max(20).optional(),
  phone: z.string().max(50).optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  timezone: z.string().max(50).optional(),
});

export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
