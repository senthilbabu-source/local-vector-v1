import { z } from 'zod';

/**
 * The three third-party platforms supported by the OAuth API Sync Engine.
 * Exported as a const tuple so both Zod schemas and UI components can
 * derive typed arrays from a single source of truth.
 */
export const INTEGRATION_PLATFORMS = ['google', 'apple', 'bing'] as const;
export type IntegrationPlatform = (typeof INTEGRATION_PLATFORMS)[number];

/**
 * The Big 6 NAP (Name, Address, Phone) platforms shown in the Listings table.
 * All 6 rows are rendered regardless of whether a DB row exists.
 * OAuth (Phase 8) will add real API sync; for now users can enter listing URLs manually.
 */
export const BIG_6_PLATFORMS = [
  'google',
  'yelp',
  'apple',
  'facebook',
  'tripadvisor',
  'bing',
] as const;
export type Big6Platform = (typeof BIG_6_PLATFORMS)[number];

/**
 * Schema for saving a listing URL for a platform.
 * URL validation enforced so only well-formed URLs reach the DB.
 */
export const SavePlatformUrlSchema = z.object({
  platform: z.enum(BIG_6_PLATFORMS, {
    message: 'Platform must be one of the Big 6 listing platforms',
  }),
  url: z
    .string()
    .url('Please enter a valid URL (e.g. https://g.page/your-business)')
    .max(2048, 'URL must be 2048 characters or fewer'),
  locationId: z.string().uuid('A valid location ID is required'),
});

export type SavePlatformUrlInput = z.infer<typeof SavePlatformUrlSchema>;

/**
 * Schema for connecting or disconnecting a platform integration.
 *
 * `connect: true`  → upsert a row with status 'connected'
 * `connect: false` → delete the integration row
 *
 * `location_id` and `platform` are not user-typed values — they are
 * derived from the UI context. They are validated here so the Server
 * Action has a single trusted parse path.
 */
export const ToggleIntegrationSchema = z.object({
  location_id: z.string().uuid('A valid location ID is required'),
  platform: z.enum(INTEGRATION_PLATFORMS, {
    message: 'Platform must be google, apple, or bing',
  }),
  connect: z.boolean(),
});

export type ToggleIntegrationInput = z.infer<typeof ToggleIntegrationSchema>;

/**
 * Schema for triggering a sync on an already-connected integration.
 * The integration row must already exist (i.e. status !== 'disconnected')
 * before this action is called.
 */
export const SyncIntegrationSchema = z.object({
  location_id: z.string().uuid('A valid location ID is required'),
  platform: z.enum(INTEGRATION_PLATFORMS, {
    message: 'Platform must be google, apple, or bing',
  }),
});

export type SyncIntegrationInput = z.infer<typeof SyncIntegrationSchema>;
