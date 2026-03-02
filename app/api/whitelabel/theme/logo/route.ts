/**
 * POST + DELETE /api/whitelabel/theme/logo — Sprint 115
 *
 * POST: Upload org logo to Supabase Storage.
 * DELETE: Remove org logo from Storage + clear DB fields.
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canCustomizeTheme } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { updateLogoUrl, removeLogo } from '@/lib/whitelabel/theme-service';
import { buildLogoStoragePath } from '@/lib/whitelabel/theme-utils';
import * as Sentry from '@sentry/nextjs';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// ---------------------------------------------------------------------------
// POST /api/whitelabel/theme/logo
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    const supabase = await createClient();
    const plan = (auth.org.plan ?? 'trial') as PlanTier;

    if (!canCustomizeTheme(plan)) {
      return NextResponse.json(
        { error: 'plan_upgrade_required', message: 'Theme customization requires the Agency plan.' },
        { status: 403 }
      );
    }

    if (auth.role !== 'owner') {
      return NextResponse.json(
        { error: 'not_owner', message: 'Only the organization owner can upload a logo.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'no_file', message: 'No logo file provided.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'invalid_type', message: `File type ${file.type} is not allowed. Use PNG, JPEG, WebP, or SVG.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'file_too_large', message: 'File size exceeds 2MB limit.' },
        { status: 400 }
      );
    }

    const storagePath = buildLogoStoragePath(auth.orgId, file.name);
    if (!storagePath) {
      return NextResponse.json(
        { error: 'invalid_extension', message: 'Unsupported file extension.' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('org-logos')
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      Sentry.captureException(uploadError, { tags: { sprint: '115', action: 'logo_upload' } });
      return NextResponse.json(
        { error: 'upload_failed', message: 'Failed to upload logo.' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('org-logos')
      .getPublicUrl(storagePath);

    const logoUrl = publicUrlData.publicUrl;

    // Update DB
    await updateLogoUrl(supabase, auth.orgId, logoUrl, storagePath);

    return NextResponse.json({ ok: true, logo_url: logoUrl });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { sprint: '115', route: 'POST /api/whitelabel/theme/logo' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/whitelabel/theme/logo
// ---------------------------------------------------------------------------

export async function DELETE() {
  try {
    const auth = await getAuthContext();
    const supabase = await createClient();
    const plan = (auth.org.plan ?? 'trial') as PlanTier;

    if (!canCustomizeTheme(plan)) {
      return NextResponse.json(
        { error: 'plan_upgrade_required', message: 'Theme customization requires the Agency plan.' },
        { status: 403 }
      );
    }

    if (auth.role !== 'owner') {
      return NextResponse.json(
        { error: 'not_owner', message: 'Only the organization owner can remove the logo.' },
        { status: 403 }
      );
    }

    await removeLogo(supabase, auth.orgId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { sprint: '115', route: 'DELETE /api/whitelabel/theme/logo' } });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
