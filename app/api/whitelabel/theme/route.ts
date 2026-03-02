/**
 * GET + POST /api/whitelabel/theme — Sprint 115
 *
 * GET: Returns current OrgTheme for authenticated user's org.
 * POST: Saves/updates theme config (owner + Agency only).
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canCustomizeTheme } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import {
  getOrgThemeOrDefault,
  upsertOrgTheme,
  ThemeError,
} from '@/lib/whitelabel/theme-service';
import { sanitizeHexColor, isValidFontFamily } from '@/lib/whitelabel/theme-utils';
import { DEFAULT_THEME } from '@/lib/whitelabel/types';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// GET /api/whitelabel/theme
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await getAuthContext();
    const supabase = await createClient();
    const plan = (auth.org.plan ?? 'trial') as PlanTier;

    const theme = await getOrgThemeOrDefault(supabase, auth.orgId);

    if (!canCustomizeTheme(plan)) {
      return NextResponse.json({
        theme: { ...DEFAULT_THEME, id: 'default', org_id: auth.orgId, logo_url: null, logo_storage_path: null, created_at: theme.created_at, updated_at: theme.updated_at },
        upgrade_required: true,
      });
    }

    return NextResponse.json({ theme, upgrade_required: false });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { sprint: '115', route: 'GET /api/whitelabel/theme' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/whitelabel/theme
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    const supabase = await createClient();
    const plan = (auth.org.plan ?? 'trial') as PlanTier;

    // Plan gate
    if (!canCustomizeTheme(plan)) {
      return NextResponse.json(
        { error: 'plan_upgrade_required', message: 'Theme customization requires the Agency plan.' },
        { status: 403 }
      );
    }

    // Owner check
    if (auth.role !== 'owner') {
      return NextResponse.json(
        { error: 'not_owner', message: 'Only the organization owner can modify the theme.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const changes: Record<string, unknown> = {};

    // Validate and sanitize inputs
    if (body.primary_color !== undefined) {
      const sanitized = sanitizeHexColor(body.primary_color);
      if (!sanitized) {
        return NextResponse.json(
          { error: 'invalid_color', message: 'Invalid primary_color format. Use #xxxxxx.' },
          { status: 400 }
        );
      }
      changes.primary_color = sanitized;
    }

    if (body.accent_color !== undefined) {
      const sanitized = sanitizeHexColor(body.accent_color);
      if (!sanitized) {
        return NextResponse.json(
          { error: 'invalid_color', message: 'Invalid accent_color format. Use #xxxxxx.' },
          { status: 400 }
        );
      }
      changes.accent_color = sanitized;
    }

    if (body.font_family !== undefined) {
      if (!isValidFontFamily(body.font_family)) {
        return NextResponse.json(
          { error: 'invalid_font', message: `Invalid font_family: ${body.font_family}` },
          { status: 400 }
        );
      }
      changes.font_family = body.font_family;
    }

    if (body.show_powered_by !== undefined) {
      changes.show_powered_by = Boolean(body.show_powered_by);
    }

    const theme = await upsertOrgTheme(supabase, auth.orgId, changes);
    return NextResponse.json({ ok: true, theme });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof ThemeError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    Sentry.captureException(err, { tags: { sprint: '115', route: 'POST /api/whitelabel/theme' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
