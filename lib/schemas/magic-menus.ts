import { z } from 'zod';

/**
 * Zod schema for creating a new Magic Menu.
 * Shared between the Server Action (server-side validation) and the
 * AddMenuModal form (client-side validation via react-hook-form).
 *
 * NOTE: The `magic_menus` table has no `name` column. The `name` field
 * here is used to derive `public_slug` via `toUniqueSlug(name)`.
 * A future migration should add `name VARCHAR(255)` to the table.
 */
export const CreateMagicMenuSchema = z.object({
  name: z
    .string()
    .min(2, 'Menu name must be at least 2 characters')
    .max(255, 'Menu name must be under 255 characters'),
  location_id: z
    .string()
    .uuid('A valid location must be selected'),
});

export type CreateMagicMenuInput = z.infer<typeof CreateMagicMenuSchema>;
