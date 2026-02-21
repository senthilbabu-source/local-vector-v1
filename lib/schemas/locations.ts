import { z } from 'zod';

/**
 * Zod schema for creating a new location.
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
