import { z } from 'zod';

/**
 * Schema for creating a new menu category.
 * `menu_id` is passed from the current editor URL — not user-typed —
 * but is included in the schema so the Server Action can validate it.
 */
export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(255, 'Category name must be under 255 characters'),
  menu_id: z.string().uuid('Invalid menu ID'),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

/**
 * Schema for creating a new menu item.
 * `menu_id` is the parent menu; `category_id` is the category FK.
 * Both are passed from the editor context, not typed by the user.
 * `price` uses z.coerce so the HTML number-input string is cast to a number.
 */
export const CreateMenuItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Item name is required')
    .max(255, 'Item name must be under 255 characters'),
  description: z
    .string()
    .max(1000, 'Description must be under 1000 characters')
    .optional()
    .or(z.literal('')),
  price: z.coerce
    .number({ message: 'Price must be a number' })
    .min(0, 'Price must be $0.00 or more')
    .max(9999.99, 'Price must be under $10,000'),
  category_id: z.string().uuid('A category must be selected'),
  menu_id: z.string().uuid('Invalid menu ID'),
});

export type CreateMenuItemInput = z.infer<typeof CreateMenuItemSchema>;
