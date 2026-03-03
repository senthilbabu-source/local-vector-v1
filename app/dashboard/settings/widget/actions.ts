'use server';

// ---------------------------------------------------------------------------
// app/dashboard/settings/widget/actions.ts — Widget Settings Server Action (Sprint 133)
// ---------------------------------------------------------------------------

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import * as Sentry from '@sentry/nextjs';

export async function updateWidgetSettings(
  locationId: string,
  data: {
    widget_enabled: boolean;
    widget_settings: {
      color: string;
      position: string;
      greeting: string;
    };
  },
) {
  const ctx = await getSafeAuthContext();
  if (!ctx) return { error: 'Unauthorized' };

  try {
    const supabase = await createClient();

    // Verify the location belongs to the user's org (RLS enforces this too)
    const { data: loc } = await supabase
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('org_id', ctx.orgId!)
      .single();

    if (!loc) return { error: 'Location not found' };

    const { error } = await (supabase
      .from('locations') as any)
      .update({
        widget_enabled: data.widget_enabled,
        widget_settings: data.widget_settings as unknown as Json,
      })
      .eq('id', locationId);

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'updateWidgetSettings', sprint: '133' },
    });
    return { error: 'Failed to save settings' };
  }
}
