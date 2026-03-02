/**
 * Theme Service — Sprint 115
 *
 * DB operations for per-org brand theme configuration.
 * Pure service — caller always passes the Supabase client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { OrgTheme, OrgThemeSave, FontFamily } from './types';
import { DEFAULT_THEME } from './types';
import { validateHexColor, computeTextOnPrimary, isValidFontFamily } from './theme-utils';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ThemeError extends Error {
  constructor(
    public readonly code: 'invalid_color' | 'invalid_font' | 'not_found' | 'update_failed',
    message: string
  ) {
    super(message);
    this.name = 'ThemeError';
  }
}

// ---------------------------------------------------------------------------
// getOrgTheme
// ---------------------------------------------------------------------------

/**
 * Fetches the org theme from DB. Returns null if no theme has been saved.
 */
export async function getOrgTheme(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<OrgTheme | null> {
  const { data, error } = await supabase
    .from('org_themes')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    org_id: data.org_id,
    primary_color: data.primary_color,
    accent_color: data.accent_color,
    text_on_primary: data.text_on_primary,
    font_family: data.font_family as FontFamily,
    logo_url: data.logo_url,
    logo_storage_path: data.logo_storage_path,
    show_powered_by: data.show_powered_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// getOrgThemeOrDefault
// ---------------------------------------------------------------------------

/**
 * Returns the org theme, or DEFAULT_THEME values if none saved.
 * Never returns null — always returns a usable theme.
 */
export async function getOrgThemeOrDefault(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<OrgTheme> {
  const theme = await getOrgTheme(supabase, orgId);
  if (theme) return theme;

  const now = new Date().toISOString();
  return {
    id: 'default',
    org_id: orgId,
    ...DEFAULT_THEME,
    logo_url: null,
    logo_storage_path: null,
    created_at: now,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// upsertOrgTheme
// ---------------------------------------------------------------------------

/**
 * Validates and upserts the org theme. Computes text_on_primary server-side.
 * Throws ThemeError on validation failure.
 */
export async function upsertOrgTheme(
  supabase: SupabaseClient<Database>,
  orgId: string,
  changes: OrgThemeSave
): Promise<OrgTheme> {
  // Validate colors
  if (changes.primary_color !== undefined && !validateHexColor(changes.primary_color)) {
    throw new ThemeError('invalid_color', `Invalid primary_color: ${changes.primary_color}`);
  }
  if (changes.accent_color !== undefined && !validateHexColor(changes.accent_color)) {
    throw new ThemeError('invalid_color', `Invalid accent_color: ${changes.accent_color}`);
  }

  // Validate font
  if (changes.font_family !== undefined && !isValidFontFamily(changes.font_family)) {
    throw new ThemeError('invalid_font', `Invalid font_family: ${changes.font_family}`);
  }

  // Compute text_on_primary if primary_color changed
  const updateFields: Record<string, unknown> = { ...changes };
  if (changes.primary_color) {
    updateFields.text_on_primary = computeTextOnPrimary(changes.primary_color);
  }
  updateFields.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('org_themes')
    .upsert(
      {
        org_id: orgId,
        ...updateFields,
      },
      { onConflict: 'org_id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new ThemeError('update_failed', error?.message ?? 'Failed to upsert theme.');
  }

  return {
    id: data.id,
    org_id: data.org_id,
    primary_color: data.primary_color,
    accent_color: data.accent_color,
    text_on_primary: data.text_on_primary,
    font_family: data.font_family as FontFamily,
    logo_url: data.logo_url,
    logo_storage_path: data.logo_storage_path,
    show_powered_by: data.show_powered_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// updateLogoUrl
// ---------------------------------------------------------------------------

/**
 * Updates the logo URL and storage path. Upserts if no theme row exists.
 */
export async function updateLogoUrl(
  supabase: SupabaseClient<Database>,
  orgId: string,
  logoUrl: string,
  storagePath: string
): Promise<OrgTheme> {
  const { data, error } = await supabase
    .from('org_themes')
    .upsert(
      {
        org_id: orgId,
        logo_url: logoUrl,
        logo_storage_path: storagePath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new ThemeError('update_failed', error?.message ?? 'Failed to update logo URL.');
  }

  return {
    id: data.id,
    org_id: data.org_id,
    primary_color: data.primary_color,
    accent_color: data.accent_color,
    text_on_primary: data.text_on_primary,
    font_family: data.font_family as FontFamily,
    logo_url: data.logo_url,
    logo_storage_path: data.logo_storage_path,
    show_powered_by: data.show_powered_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// ---------------------------------------------------------------------------
// removeLogo
// ---------------------------------------------------------------------------

/**
 * Removes the org logo from Storage and clears DB fields.
 * Idempotent — returns success even if no logo exists.
 */
export async function removeLogo(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<{ success: true }> {
  // Fetch current logo path
  const theme = await getOrgTheme(supabase, orgId);

  if (theme?.logo_storage_path) {
    await supabase.storage
      .from('org-logos')
      .remove([theme.logo_storage_path]);
  }

  if (theme) {
    await supabase
      .from('org_themes')
      .update({
        logo_url: null,
        logo_storage_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId);
  }

  return { success: true };
}
