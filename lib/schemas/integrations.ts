import { z } from 'zod';

/**
 * The three third-party platforms supported by the API Sync Engine.
 * Exported as a const tuple so both Zod schemas and UI components can
 * derive typed arrays from a single source of truth.
 */
export const INTEGRATION_PLATFORMS = ['google', 'apple', 'bing'] as const;
export type IntegrationPlatform = (typeof INTEGRATION_PLATFORMS)[number];

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
    errorMap: () => ({ message: 'Platform must be google, apple, or bing' }),
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
    errorMap: () => ({ message: 'Platform must be google, apple, or bing' }),
  }),
});

export type SyncIntegrationInput = z.infer<typeof SyncIntegrationSchema>;
