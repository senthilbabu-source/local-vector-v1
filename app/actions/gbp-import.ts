'use server';

// ---------------------------------------------------------------------------
// app/actions/gbp-import.ts — Server Action for GBP Data Import (Sprint 89)
//
// Wrapper that calls POST /api/gbp/import internally.
// Can be called from both the onboarding wizard and the settings/dashboard.
// ---------------------------------------------------------------------------

import type { MappedLocationData } from '@/lib/gbp/gbp-data-mapper';

export interface GBPImportResult {
  ok: boolean;
  mapped?: MappedLocationData;
  location_id?: string;
  error?: string;
  error_code?: 'not_connected' | 'token_expired' | 'gbp_api_error' | 'no_location' | 'upsert_failed';
}

/**
 * Triggers GBP data import for the current user's org.
 * Calls POST /api/gbp/import internally via fetch.
 */
export async function triggerGBPImport(): Promise<GBPImportResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    // Forward cookies for auth by using next/headers
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const res = await fetch(`${appUrl}/api/gbp/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error: data.message ?? data.error ?? 'Import failed',
        error_code: data.error,
      };
    }

    return {
      ok: true,
      mapped: data.mapped,
      location_id: data.location_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
